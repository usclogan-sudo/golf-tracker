// Supabase Edge Function: import-scorecard-photo
//
// POST { photo (base64 data URL or raw base64), roundId, players[], coursePars[] }
// → calls Anthropic vision API with the prompt template, returns parsed JSON.
//
// The Anthropic API key lives in the Supabase secret ANTHROPIC_API_KEY; never
// hand it to the client. The function verifies the caller is authenticated via
// the Authorization header (Supabase forwards the user's JWT automatically when
// invoked via supabase.functions.invoke).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { buildExtractionPrompt, MODEL, MAX_TOKENS } from './prompt.ts'

interface Player { id: string; name: string }
interface CoursePar { hole: number; par: number }
interface RequestBody {
  photo: string
  roundId: string
  players: Player[]
  coursePars: CoursePar[]
}

interface MappingEntry {
  playerId: string
  cardColumnLabel: string
  confidence: 'high' | 'medium' | 'low'
}
interface ScoreEntry {
  playerId: string
  holeNumber: number
  grossScore: number | null
  confidence: 'high' | 'medium' | 'low'
}
interface ExtractionResult {
  playerColumnMapping: MappingEntry[]
  scores: ScoreEntry[]
  notes: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, code: code ?? 'extraction_error' }, status)
}

/** Strip data-URL prefix if present so we can pass raw base64 to Anthropic. */
function normalizeBase64(photo: string): { mediaType: string; data: string } {
  const dataUrlMatch = photo.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/)
  if (dataUrlMatch) {
    return { mediaType: dataUrlMatch[1], data: dataUrlMatch[2] }
  }
  return { mediaType: 'image/jpeg', data: photo }
}

/** Extract a JSON object from the model output. The model is told to return
 *  strict JSON, but defensive parsing handles the rare case where it wraps
 *  the JSON in markdown fences or includes leading whitespace. */
function parseModelJson(text: string): ExtractionResult {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim()
  }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }
  return JSON.parse(cleaned)
}

/** Sanity-check the extraction before returning to the client. */
function validateAndSanitize(
  result: ExtractionResult,
  players: Player[],
  coursePars: CoursePar[],
): ExtractionResult {
  const validPlayerIds = new Set(players.map((p) => p.id))
  const maxHole = coursePars.length

  const mapping = (result.playerColumnMapping ?? []).filter((m) =>
    validPlayerIds.has(m.playerId),
  )

  const scores = (result.scores ?? [])
    .filter((s) => validPlayerIds.has(s.playerId))
    .filter((s) => Number.isInteger(s.holeNumber) && s.holeNumber >= 1 && s.holeNumber <= maxHole)
    .map((s) => {
      // Force any out-of-range or non-integer score to null + low confidence.
      if (s.grossScore != null) {
        const v = Number(s.grossScore)
        if (!Number.isFinite(v) || !Number.isInteger(v) || v < 1 || v > 15) {
          return { ...s, grossScore: null, confidence: 'low' as const }
        }
      }
      const conf = ['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'low'
      return { ...s, confidence: conf }
    })

  return {
    playerColumnMapping: mapping,
    scores,
    notes: typeof result.notes === 'string' ? result.notes : '',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, 'method_not_allowed')
  }

  // Auth check — Supabase forwards the caller's JWT in Authorization: Bearer ...
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Not authenticated', 401, 'auth_required')
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return errorResponse('Server not configured (missing API key)', 500, 'server_misconfigured')
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400, 'bad_request')
  }

  if (!body.photo || !body.roundId || !Array.isArray(body.players) || !Array.isArray(body.coursePars)) {
    return errorResponse('Missing required fields: photo, roundId, players, coursePars', 400, 'bad_request')
  }
  if (body.players.length === 0) {
    return errorResponse('Player list is empty', 400, 'bad_request')
  }
  if (body.coursePars.length === 0) {
    return errorResponse('Course par list is empty', 400, 'bad_request')
  }
  if (body.coursePars.length > 36) {
    return errorResponse('Course par list too long (>36 holes)', 400, 'bad_request')
  }

  const { mediaType, data } = normalizeBase64(body.photo)
  // 6 MB base64 ≈ 4.5 MB photo — generous; client should resize but we cap as a backstop.
  if (data.length > 6_000_000) {
    return errorResponse('Photo too large; resize before upload', 413, 'photo_too_large')
  }

  const prompt = buildExtractionPrompt({ players: body.players, coursePars: body.coursePars })

  const anthropicReq = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  }

  let anthropicRes: Response
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(anthropicReq),
    })
  } catch (e) {
    return errorResponse(`Upstream call failed: ${e instanceof Error ? e.message : 'unknown'}`, 502, 'upstream_unreachable')
  }

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text()
    return errorResponse(`Vision API error (${anthropicRes.status}): ${errBody.slice(0, 500)}`, 502, 'upstream_error')
  }

  const apiJson = await anthropicRes.json()
  const text: string | undefined = apiJson?.content?.[0]?.text
  if (!text) {
    return errorResponse('Vision API returned no text content', 502, 'upstream_empty')
  }

  let parsed: ExtractionResult
  try {
    parsed = parseModelJson(text)
  } catch (e) {
    return errorResponse(`Could not parse model output as JSON: ${e instanceof Error ? e.message : 'unknown'}`, 502, 'parse_failed')
  }

  const sanitized = validateAndSanitize(parsed, body.players, body.coursePars)

  return jsonResponse(sanitized)
})

#!/usr/bin/env node
/**
 * Local test harness for the photo-import prompt.
 *
 * Calls Anthropic's vision API directly with a real scorecard photo and
 * the canonical prompt template, then prints the parsed extraction. Use
 * this to iterate on the prompt without redeploying the Edge Function.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/test-photo-import.mjs <photo.jpg>
 *
 * The test players and course pars are hardcoded below for a typical
 * 4-player 18-hole round — edit them to match your test photo's expected
 * contents to get a real accuracy read.
 *
 * Cost: ~$0.01-0.02 per run.
 */

import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

const TEST_PLAYERS = [
  { id: 'p1', name: 'Alex' },
  { id: 'p2', name: 'Brian' },
  { id: 'p3', name: 'Carl' },
  { id: 'p4', name: 'Dave' },
]

// Generic 18-hole par pattern. Edit to match the course on your test card.
const TEST_COURSE_PARS = [
  { hole: 1, par: 4 },  { hole: 2, par: 3 },  { hole: 3, par: 5 },
  { hole: 4, par: 4 },  { hole: 5, par: 4 },  { hole: 6, par: 3 },
  { hole: 7, par: 5 },  { hole: 8, par: 4 },  { hole: 9, par: 4 },
  { hole: 10, par: 4 }, { hole: 11, par: 3 }, { hole: 12, par: 5 },
  { hole: 13, par: 4 }, { hole: 14, par: 4 }, { hole: 15, par: 3 },
  { hole: 16, par: 5 }, { hole: 17, par: 4 }, { hole: 18, par: 4 },
]

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2048

// Keep this in sync with supabase/functions/import-scorecard-photo/prompt.ts.
// Local copy avoids needing Deno/TypeScript runtime to test.
function buildExtractionPrompt({ players, coursePars }) {
  const playerList = players
    .map((p, i) => `  ${i + 1}. ${p.name} (id: ${p.id})`)
    .join('\n')
  const parList = coursePars
    .sort((a, b) => a.hole - b.hole)
    .map((c) => `${c.hole}:par${c.par}`)
    .join(', ')

  return `You are reading a photo of a golf scorecard. Extract every player's gross score for every hole.

ROUND CONTEXT
=============

Players in this round (in roster order — typically left-to-right on the card):
${playerList}

Course pars by hole: ${parList}

YOUR JOB
========

Step 1 — Match scorecard columns to players.
For each score column on the card, match it to one of the player IDs above.
- Prefer matching by the name written on the card. The card may use a nickname ("Mike" → Michael), last name only, initials, or a misspelling — match these to the closest player from the list.
- If two players could match (e.g. card says "Steve" and the round has two Steves), pick the one whose roster position matches the column position and mark confidence "low".
- If the card has fewer columns than the player list, or more columns than the player list, return only the columns that exist on the card. Do not invent players.
- If a column is unreadable or has no name written, fall back to roster order and mark confidence "low".

Confidence for each mapping:
- "high" — name on card clearly matches the player (full name, exact match, or unambiguous nickname)
- "medium" — matched by fuzzy name (initials, last-name-only, or close misspelling)
- "low" — matched by column position only, or ambiguous

Step 2 — Extract every score.
For each (player × hole) cell, read the gross score the player wrote.

Confidence for each score:
- "high" — digit is clearly legible and within sane range
- "medium" — legible but slightly ambiguous (e.g. could be 4 or 9), or unusually far from par
- "low" — illegible, blank, or impossible to read with any certainty

Sanity checks (apply these to each score):
- Scores below 1 or above 15 are physically impossible — return null and confidence "low".
- A score more than 5 strokes over par is unusual — keep the reading but mark "medium".
- If a cell appears blank or crossed out, return null and confidence "low".
- Do not infer scores from running totals; read each individual cell.

Step 3 — Return strict JSON.

Return ONLY valid JSON in the exact shape below. No prose, no markdown, no commentary outside the JSON.

{
  "playerColumnMapping": [
    {
      "playerId": "<one of the IDs above>",
      "cardColumnLabel": "<the name as written on the card, or 'col-N' if unreadable>",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "scores": [
    {
      "playerId": "<one of the IDs above>",
      "holeNumber": <1-${coursePars.length}>,
      "grossScore": <integer 1-15> | null,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "notes": "<short string: any concerns, missing players, photo quality issues, or anomalies you noticed>"
}

Edge cases:
- If you cannot identify the scorecard at all (wrong kind of photo, too blurry, etc.), return:
  { "playerColumnMapping": [], "scores": [], "notes": "could not parse: <reason>" }
- If only some holes are visible (e.g. front 9 only), return scores for the holes you can see and note the missing range.
- Same player appearing in two columns (e.g. correction strike-through) — pick the column that looks final, ignore the crossed-out one.

Begin extraction.`
}

function inferMediaType(path) {
  const ext = extname(path).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/jpeg'
}

async function main() {
  const photoPath = process.argv[2]
  if (!photoPath) {
    console.error('Usage: ANTHROPIC_API_KEY=... node scripts/test-photo-import.mjs <photo.jpg>')
    process.exit(1)
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('Set ANTHROPIC_API_KEY env var (sk-ant-...).')
    process.exit(1)
  }

  const data = readFileSync(photoPath).toString('base64')
  const mediaType = inferMediaType(photoPath)
  console.error(`→ ${photoPath} (${mediaType}, ${(data.length / 1024).toFixed(0)} KB base64)`)
  console.error(`→ Calling ${MODEL} ...`)

  const startMs = Date.now()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: buildExtractionPrompt({ players: TEST_PLAYERS, coursePars: TEST_COURSE_PARS }) },
          ],
        },
      ],
    }),
  })

  const elapsedMs = Date.now() - startMs
  console.error(`→ ${res.status} in ${elapsedMs}ms`)

  if (!res.ok) {
    console.error(await res.text())
    process.exit(1)
  }

  const apiJson = await res.json()
  const text = apiJson?.content?.[0]?.text
  if (!text) {
    console.error('No text in response:', JSON.stringify(apiJson).slice(0, 500))
    process.exit(1)
  }

  // Defensive: strip markdown fences if the model added them despite the instruction.
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim()
  }

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    console.error('Failed to parse JSON. Raw model output:')
    console.error(text)
    process.exit(1)
  }

  console.log(JSON.stringify(parsed, null, 2))

  // Quick accuracy summary
  const scoreCount = parsed.scores?.length ?? 0
  const high = parsed.scores?.filter((s) => s.confidence === 'high').length ?? 0
  const med = parsed.scores?.filter((s) => s.confidence === 'medium').length ?? 0
  const low = parsed.scores?.filter((s) => s.confidence === 'low').length ?? 0
  console.error(`\nSummary: ${scoreCount} scores extracted — ${high} high, ${med} medium, ${low} low`)
  if (parsed.notes) console.error(`Notes from model: ${parsed.notes}`)

  // Approximate cost: Sonnet 4.6 is ~$3/MTok input, $15/MTok output as of 2026.
  const usage = apiJson.usage ?? {}
  if (usage.input_tokens && usage.output_tokens) {
    const cost = (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15
    console.error(`Tokens: ${usage.input_tokens} in / ${usage.output_tokens} out · ~$${cost.toFixed(4)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

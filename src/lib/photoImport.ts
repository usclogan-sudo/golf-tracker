import { supabase, holeScoreToRow } from './supabase'
import type { Player, CourseSnapshot, HoleScore } from '../types'
import { v4 as uuidv4 } from 'uuid'

export type Confidence = 'high' | 'medium' | 'low'

export interface PlayerColumnMapping {
  playerId: string
  cardColumnLabel: string
  confidence: Confidence
}

export interface ExtractedScore {
  playerId: string
  holeNumber: number
  grossScore: number | null
  confidence: Confidence
}

export interface ExtractionResult {
  playerColumnMapping: PlayerColumnMapping[]
  scores: ExtractedScore[]
  notes: string
}

const MAX_EDGE = 2048
const JPEG_QUALITY = 0.85

/**
 * Resize and re-encode a user-supplied photo so the upload stays small and
 * the model gets a clean JPEG. Long edge clamped to MAX_EDGE; format forced
 * to JPEG since Anthropic accepts it and PNGs can be 5-10x larger for photos.
 */
export async function resizePhotoForUpload(file: File): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file)
  const longEdge = Math.max(bitmap.width, bitmap.height)
  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context for photo')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Could not encode photo as JPEG')

  const base64 = await blobToBase64(blob)
  return { base64, mediaType: 'image/jpeg' }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip the "data:<mime>;base64," prefix — Edge Function accepts either,
      // but raw base64 is what Anthropic ultimately wants.
      const idx = dataUrl.indexOf(',')
      resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Send a resized photo to the Edge Function and parse the structured result.
 * Throws on any non-2xx; UI should show the error inline.
 */
export async function extractScoresFromPhoto(args: {
  photoBase64: string
  roundId: string
  players: Player[]
  snapshot: CourseSnapshot
}): Promise<ExtractionResult> {
  const { photoBase64, roundId, players, snapshot } = args
  const coursePars = snapshot.holes
    .slice()
    .sort((a, b) => a.number - b.number)
    .map(h => ({ hole: h.number, par: h.par }))

  const { data, error } = await supabase.functions.invoke('import-scorecard-photo', {
    body: {
      photo: photoBase64,
      roundId,
      players: players.map(p => ({ id: p.id, name: p.name })),
      coursePars,
    },
  })

  if (error) {
    const msg = (error as any)?.message ?? 'Photo import failed'
    throw new Error(msg)
  }
  if (!data) {
    throw new Error('Photo import returned no data')
  }
  return data as ExtractionResult
}

/**
 * Bulk-write reviewed scores to the round in a single round-trip.
 * Caller is responsible for showing the confirm grid first; this function
 * trusts whatever it's handed. Existing scores for the same (player, hole)
 * are updated in place rather than duplicated, courtesy of the unique
 * constraint shipped in Batch A.
 */
export async function bulkSaveImportedScores(args: {
  roundId: string
  userId: string
  scores: { playerId: string; holeNumber: number; grossScore: number }[]
  existing: HoleScore[]
}): Promise<{ updated: number; inserted: number }> {
  const { roundId, userId, scores, existing } = args
  const existingByKey = new Map<string, HoleScore>()
  for (const s of existing) {
    existingByKey.set(`${s.playerId}-${s.holeNumber}`, s)
  }

  const updates: { id: string; gross_score: number }[] = []
  const inserts: HoleScore[] = []
  for (const s of scores) {
    const key = `${s.playerId}-${s.holeNumber}`
    const existingScore = existingByKey.get(key)
    if (existingScore) {
      updates.push({ id: existingScore.id, gross_score: s.grossScore })
    } else {
      inserts.push({
        id: uuidv4(),
        roundId,
        playerId: s.playerId,
        holeNumber: s.holeNumber,
        grossScore: s.grossScore,
      })
    }
  }

  // Updates first so we don't briefly have duplicate rows during the upsert.
  if (updates.length > 0) {
    const promises = updates.map(u =>
      supabase.from('hole_scores').update({ gross_score: u.gross_score }).eq('id', u.id),
    )
    const results = await Promise.all(promises)
    for (const r of results) {
      if (r.error) throw r.error
    }
  }

  if (inserts.length > 0) {
    const rows = inserts.map(s => holeScoreToRow(s, userId))
    const { error } = await supabase.from('hole_scores').insert(rows)
    if (error) throw error
  }

  return { updated: updates.length, inserted: inserts.length }
}

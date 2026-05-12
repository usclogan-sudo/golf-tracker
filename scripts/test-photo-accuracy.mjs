#!/usr/bin/env node
/**
 * Batch accuracy harness for the photo-import prompt.
 *
 * Walks tests/scorecard-photos/<NN>/ folders, runs each photo through the
 * Anthropic vision API with the canonical prompt, compares extracted scores
 * to the answer key, and reports per-card + aggregate accuracy and
 * confidence calibration.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/test-photo-accuracy.mjs
 *
 * Optional flags:
 *   --only <name>   Run only the named test case (e.g. --only 03)
 *   --model <id>    Override the model (default claude-sonnet-4-6)
 *   --concurrency N Parallel requests (default 3; rate limits permitting)
 *
 * Each test case is a folder with:
 *   photo.{jpg,jpeg,png,heic,webp}
 *   answer.json — see tests/scorecard-photos/sample/answer.json for shape
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { extname, join, basename } from 'node:path'

const ROOT = new URL('../tests/scorecard-photos/', import.meta.url).pathname
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2048
const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp'])

// Keep this prompt in lockstep with supabase/functions/import-scorecard-photo/prompt.ts.
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

function parseArgs(argv) {
  const args = { only: null, model: DEFAULT_MODEL, concurrency: 3 }
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--only') args.only = argv[++i]
    else if (flag === '--model') args.model = argv[++i]
    else if (flag === '--concurrency') args.concurrency = parseInt(argv[++i], 10) || 3
  }
  return args
}

function inferMediaType(path) {
  const ext = extname(path).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}

function findTestCases(only) {
  if (!existsSync(ROOT)) return []
  const entries = readdirSync(ROOT)
    .filter((name) => {
      if (name.startsWith('.') || name === 'README.md') return false
      const full = join(ROOT, name)
      return statSync(full).isDirectory()
    })
    .filter((name) => name !== 'sample')
    .filter((name) => (only ? name === only : true))
    .sort()

  return entries
    .map((name) => {
      const dir = join(ROOT, name)
      const files = readdirSync(dir)
      const photoName = files.find((f) => PHOTO_EXTS.has(extname(f).toLowerCase()))
      const answerPath = join(dir, 'answer.json')
      if (!photoName) {
        console.warn(`  [skip ${name}] no photo found`)
        return null
      }
      if (!existsSync(answerPath)) {
        console.warn(`  [skip ${name}] no answer.json`)
        return null
      }
      return {
        name,
        photoPath: join(dir, photoName),
        answer: JSON.parse(readFileSync(answerPath, 'utf8')),
      }
    })
    .filter(Boolean)
}

async function runOneCase(testCase, apiKey, model) {
  const { name, photoPath, answer } = testCase
  const data = readFileSync(photoPath).toString('base64')
  const mediaType = inferMediaType(photoPath)

  const startMs = Date.now()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: buildExtractionPrompt({ players: answer.players, coursePars: answer.coursePars }) },
          ],
        },
      ],
    }),
  })
  const elapsedMs = Date.now() - startMs

  if (!res.ok) {
    const errText = await res.text()
    return { name, error: `${res.status} ${errText.slice(0, 200)}`, elapsedMs }
  }
  const apiJson = await res.json()
  const text = apiJson?.content?.[0]?.text
  if (!text) return { name, error: 'no text in response', elapsedMs }

  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim()
  }
  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    return { name, error: `JSON parse failed: ${e.message}`, raw: text, elapsedMs }
  }

  // Score the extraction
  const expected = answer.expectedScores
  const totals = {
    total: 0,
    correct: 0,
    wrongByConfidence: { high: 0, medium: 0, low: 0 },
    correctByConfidence: { high: 0, medium: 0, low: 0 },
    misses: [],
  }
  for (const playerId of Object.keys(expected)) {
    for (const [holeStr, expectedScore] of Object.entries(expected[playerId])) {
      const hole = parseInt(holeStr, 10)
      totals.total++
      const got = parsed.scores?.find(
        (s) => s.playerId === playerId && s.holeNumber === hole,
      )
      const gotScore = got?.grossScore ?? null
      const conf = got?.confidence ?? 'low'
      const match = gotScore === expectedScore
      if (match) {
        totals.correct++
        totals.correctByConfidence[conf]++
      } else {
        totals.wrongByConfidence[conf]++
        totals.misses.push({
          playerId,
          playerName: answer.players.find((p) => p.id === playerId)?.name ?? playerId,
          hole,
          expected: expectedScore,
          got: gotScore,
          confidence: conf,
        })
      }
    }
  }

  return {
    name,
    elapsedMs,
    notes: parsed.notes ?? '',
    usage: apiJson.usage ?? {},
    totals,
  }
}

async function runWithConcurrency(items, concurrency, fn) {
  const results = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return results
}

function pct(num, denom) {
  if (denom === 0) return 'n/a'
  return ((100 * num) / denom).toFixed(1) + '%'
}

async function main() {
  const args = parseArgs(process.argv)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('Set ANTHROPIC_API_KEY env var (sk-ant-...).')
    process.exit(1)
  }

  const cases = findTestCases(args.only)
  if (cases.length === 0) {
    console.error(`No test cases found in ${ROOT}.`)
    console.error(`Drop scorecards into subfolders following tests/scorecard-photos/sample/answer.json.`)
    process.exit(1)
  }

  console.error(`Running ${cases.length} test case${cases.length === 1 ? '' : 's'} on ${args.model} (concurrency ${args.concurrency}) …`)

  const results = await runWithConcurrency(cases, args.concurrency, (c) => runOneCase(c, apiKey, args.model))

  // ── Per-card report ──────────────────────────────────────────────────────
  let totalCells = 0
  let totalCorrect = 0
  const overall = {
    correctByConfidence: { high: 0, medium: 0, low: 0 },
    wrongByConfidence: { high: 0, medium: 0, low: 0 },
  }
  let totalTokensIn = 0
  let totalTokensOut = 0

  for (const r of results) {
    if (r.error) {
      console.log(`\n❌ ${r.name}: error — ${r.error} (${r.elapsedMs}ms)`)
      continue
    }
    const t = r.totals
    totalCells += t.total
    totalCorrect += t.correct
    for (const c of ['high', 'medium', 'low']) {
      overall.correctByConfidence[c] += t.correctByConfidence[c]
      overall.wrongByConfidence[c] += t.wrongByConfidence[c]
    }
    totalTokensIn += r.usage.input_tokens ?? 0
    totalTokensOut += r.usage.output_tokens ?? 0

    const accuracy = pct(t.correct, t.total)
    const flag = t.correct === t.total ? '✅' : t.wrongByConfidence.high > 0 ? '⚠️ ' : '◐ '
    console.log(`\n${flag} ${r.name}: ${t.correct}/${t.total} correct (${accuracy}) — ${r.elapsedMs}ms`)
    if (r.notes) console.log(`   model notes: ${r.notes}`)
    if (t.misses.length > 0) {
      console.log(`   misses:`)
      for (const m of t.misses) {
        console.log(`     hole ${m.hole} ${m.playerName}: read ${m.got ?? 'null'}, actual ${m.expected} [${m.confidence}]`)
      }
    }
  }

  // ── Aggregate ────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log('AGGREGATE')
  console.log('─'.repeat(60))
  console.log(`Overall:        ${totalCorrect}/${totalCells} (${pct(totalCorrect, totalCells)})`)
  for (const c of ['high', 'medium', 'low']) {
    const correct = overall.correctByConfidence[c]
    const wrong = overall.wrongByConfidence[c]
    const denom = correct + wrong
    console.log(`${c.padEnd(7)}:        ${correct}/${denom} correct (${pct(correct, denom)})`)
  }

  const highWrongPct = overall.wrongByConfidence.high / (overall.correctByConfidence.high + overall.wrongByConfidence.high || 1)
  if (highWrongPct > 0.01) {
    console.log(`\n⚠️  ${(highWrongPct * 100).toFixed(1)}% of high-confidence cells are wrong. Calibration is off — prompt needs work.`)
  } else if (totalCorrect / totalCells > 0.95) {
    console.log('\n✅ Above target (95% overall).')
  } else {
    console.log('\n◐ Below 95% overall. See per-card misses to identify patterns.')
  }

  if (totalTokensIn || totalTokensOut) {
    const cost = (totalTokensIn / 1_000_000) * 3 + (totalTokensOut / 1_000_000) * 15
    console.log(`\nCost: $${cost.toFixed(3)} (${totalTokensIn} in / ${totalTokensOut} out)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

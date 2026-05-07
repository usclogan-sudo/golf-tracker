// Prompt template for the photo-to-scorecard extraction.
// Iterating on this string is how we tune accuracy — it's separated from the
// HTTP handler so we can adjust without redeploying the function shell.

export interface PromptContext {
  players: { id: string; name: string }[]
  coursePars: { hole: number; par: number }[]
}

export function buildExtractionPrompt(ctx: PromptContext): string {
  const playerList = ctx.players
    .map((p, i) => `  ${i + 1}. ${p.name} (id: ${p.id})`)
    .join('\n')
  const parList = ctx.coursePars
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
      "holeNumber": <1-${ctx.coursePars.length}>,
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

/** The Anthropic vision model to use. Sonnet 4.6 is the price/accuracy sweet spot. */
export const MODEL = 'claude-sonnet-4-6'

/** Cap output tokens — strict JSON for an 18-hole 4-player card is well under 2k. */
export const MAX_TOKENS = 2048

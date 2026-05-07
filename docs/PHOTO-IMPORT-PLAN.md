# Photo-to-Scorecard Import — Build Plan

A scoped plan for snapping a photo of a paper scorecard and having the app fill in scores for an existing round.

> **Created:** May 2026
> **Estimated effort:** 8–12 days of focused dev work
> **Estimated runtime cost:** ~$30–100/month at 1K users

---

## Context

Today, all scores must be entered tap-by-tap during play. That works for the live use case but loses two big opportunities:

1. **Post-hoc rounds** — group played without the app and used a paper card. They want to log it after.
2. **Historical backfill** — power users have years of paper cards they'd love to digitize for handicap and stats history.

The plan: take a photo, send it to a vision-capable AI model, get structured scores back, let the user review/correct, then save. This piggybacks on infrastructure we already have (Supabase, Edge Functions, the round/score data model).

**Non-goal:** replacing live tap-as-you-play. That's already faster than this flow could ever be. Photo import is for after-the-fact entry.

---

## Decisions to make before we start

These are 5-minute conversations, not show-stoppers. Capturing here so the build doesn't stall mid-flight.

| # | Decision | Default if you don't pick |
|---|---|---|
| D1 | **Which AI provider?** Claude (Anthropic), GPT-4V (OpenAI), or Gemini Vision (Google). | Claude Sonnet 4.6 — best price/accuracy balance, same vendor as the rest of the stack. |
| D2 | **Where does the API key live?** Supabase secret + Edge Function (safe), or browser env (insecure). | Supabase Edge Function. Browser-side API keys leak immediately. |
| D3 | **Cost cap?** Cheap photos (~$0.01) vs. fancy reasoning (~$0.05). | Sonnet 4.6 — defaults to ~$0.01–0.02/photo. Spend ceiling: $50/mo before we revisit. |
| D4 | **Where in the UI does it go?** "Import from photo" button on (a) the Scorecard screen for an active round, (b) the Round History screen for old rounds, or (c) both. | Both. The Scorecard entry covers post-hoc same-day; the History entry covers back-catalog digitization. |
| D5 | **Photo storage?** Save the original photo as evidence/audit trail, or process-and-discard. | Process-and-discard for v1. Smaller surface area, no privacy questions. Add storage later if there's a clear need. |
| D6 | **Course import as a follow-up?** Same OCR pipeline can read par/stroke-index/yardages from a card header to auto-create courses. | Defer to v2. Ship score import first, validate the model's accuracy, then layer course import on top. |

---

## What ships in v1 (the minimum useful version)

**The user flow:**
1. User opens the Scorecard for an active round (players + course already picked).
2. Taps a new **"Import from photo"** button (small, in the header menu — not in the way of tap-scoring).
3. Phone camera opens. Snap a photo of the paper card. Re-take if needed.
4. ~2–3 seconds processing.
5. **Confirmation grid** appears: every hole × every player, with extracted scores pre-filled. Cells are color-coded:
   - 🟢 **Green** — high-confidence extraction
   - 🟡 **Yellow** — "please double-check"
   - 🔴 **Red** — model couldn't read this hole
6. User taps any cell to correct it. The grid uses the same number pad as live scoring.
7. **Save All** button writes everything to the round in one go.

**What doesn't ship in v1:**
- Photo storage / audit log
- Course auto-creation from card
- "Import from history" (back-catalog) entry point — we'll add it as a fast follow once v1 proves itself
- Multi-card support (one photo per round only)
- Auto-rotation / perspective correction (rely on the model to handle perspective; we just send the raw photo)

---

## The milestones

Five milestones, each independently shippable / testable. Build in order — each one unlocks the next.

### Milestone 1 — Backend wiring (1–2 days)

**Goal:** A Supabase Edge Function that takes a base64 image + round context, calls Claude, returns structured scores.

- New Edge Function `import-scorecard-photo`.
- Stores Anthropic API key in Supabase secrets (never in client code).
- Accepts: `{ photo (base64), roundId, players: [{id, name}], coursePars: [{hole, par}] }`.
- Calls Claude with a structured prompt that includes the players + pars for cross-checking.
- Returns: `{ scores: [{playerId, holeNumber, grossScore, confidence: 'high'|'medium'|'low'}], notes: string }`.
- Handles: model errors, malformed JSON in response, photo too large, API rate limits.

**Files to create:**
- `supabase/functions/import-scorecard-photo/index.ts` (the Edge Function)
- `supabase/functions/import-scorecard-photo/prompt.ts` (the prompt template — extracted so we can iterate on it without redeploying)
- `src/lib/photoImport.ts` (browser-side: takes a `File`, base64-encodes it, calls the Edge Function, returns the parsed result)

**Verify:** Hit the Edge Function locally with a test photo + curl. Confirm the JSON shape comes back clean for a known card.

---

### Milestone 2 — Photo capture UI (1 day)

**Goal:** A button somewhere in the Scorecard that opens the camera, lets the user retake, and hands the photo to Milestone 1's helper.

- New `<PhotoImportButton>` component.
- Uses `<input type="file" accept="image/*" capture="environment">` — the simplest cross-browser path that works on iOS Safari and Android Chrome.
- Preview screen: shows the photo, "Use this" / "Retake" buttons.
- Loading state while the Edge Function processes (2–3 sec typical).

**Files to create / touch:**
- `src/components/Scorecard/PhotoImportButton.tsx` (new)
- `src/components/Scorecard/Scorecard.tsx` (add the button to the header menu)

**Verify:** Take a photo, see it preview, see the loading spinner, get a result back from the Edge Function. Don't worry about the result UI yet.

---

### Milestone 3 — Confirmation grid (2–3 days)

**Goal:** The screen that turns the Edge Function's JSON into a reviewable grid.

- New `<PhotoImportConfirmGrid>` component.
- Layout: rows = holes 1–18, columns = players. Each cell shows the extracted score with a colored border (green/yellow/red) for confidence.
- Tap any cell → number pad pops up to correct.
- Hole rows that the model couldn't read at all are red and pre-empty (user must enter them).
- "Save All" writes every score in one bulk transaction.
- "Cancel" discards everything.

**Files to create / touch:**
- `src/components/Scorecard/PhotoImportConfirmGrid.tsx` (new)
- `src/components/Scorecard/Scorecard.tsx` (route between live scorecard and confirm grid)
- `src/lib/photoImport.ts` (add a `bulkSaveScores(roundId, scores)` helper that writes all the hole_scores in one go via the existing offline queue + RPC paths)

**Verify:** Take a photo, see the grid populate, edit a few cells, save, see the round populated correctly. Verify no duplicate hole_score rows (the unique constraint added in Batch A protects this).

---

### Milestone 4 — Error handling + edge cases (1–2 days)

**Goal:** Graceful failure for the 5–10% of photos that don't process cleanly.

- "Photo unclear, please retake" path when confidence is universally low.
- "Some scores couldn't be read" banner above the confirm grid when ≥2 cells are red.
- Network error fallback (Edge Function down, no internet).
- Photo size cap (resize client-side to 2048px max-edge before upload — the model doesn't need full resolution and big photos are slow).
- Player-name mismatch: if the model says "Mike" but the round has "Michael", best-effort fuzzy match + show a warning.
- Score sanity check: any score < 1 or > 15 is auto-flagged red even if the model said high-confidence.

**Files to touch:**
- `src/lib/photoImport.ts` (resize + sanity checks)
- `src/components/Scorecard/PhotoImportConfirmGrid.tsx` (low-confidence banner)

---

### Milestone 5 — Prompt tuning + accuracy validation (2–3 days)

**Goal:** Take 10–20 real scorecard photos and tune the prompt + post-processing until per-hole accuracy is reliably above 95%.

- Collect a test set: photos of real scorecards from a few different courses, different lighting, different handwriting.
- Build a tiny harness in `__tests__/photoImport.test.ts` that runs each test photo through the prompt and checks against the known-correct answers.
- Iterate on the prompt template until the test suite passes consistently.
- Document the prompt and any tricky cases in `supabase/functions/import-scorecard-photo/prompt.ts` comments.

**Files to touch:**
- `supabase/functions/import-scorecard-photo/prompt.ts` (the prompt itself)
- `src/lib/__tests__/photoImport.test.ts` (new — gated to skip in CI but runnable locally)
- `tests/scorecard-photos/` (the actual test images, gitignored or stored in a separate repo to keep this one lean)

**Verify:** Run the test harness, see ≥95% accuracy on the test set. Specifically: every "high confidence" cell should be correct ≥99% of the time (low-confidence misses are fine, the user catches those).

---

## Critical files (reference)

Existing files to extend, not duplicate:
- `src/lib/offlineQueue.ts` — already handles bulk writes; we'll route the "save all" through this.
- `src/lib/realtimeReducers.ts` — score writes will fan out to other devices in the round automatically; no extra plumbing needed.
- `supabase/supabase-schema-security-hardening.sql` — `submit_event_score` and the unique-constraint migration we shipped in Batch A — bulk inserts ride on these existing protections.
- `src/components/Scorecard/NumberPad.tsx` — reuse for the "tap to correct" cell editor.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Vision LLMs hallucinate.** Even at 95%+ accuracy, occasional confident-but-wrong scores will happen. | Mandatory confirmation grid — never silently commit AI output. Color-code by confidence. |
| **Privacy: photos contain player names.** | Photos go to Anthropic via Supabase Edge Function (HTTPS), never stored in our DB or logs. Add a one-line note in the modal: "Photo is sent to an AI model for processing and not retained." |
| **API costs balloon.** | Sonnet 4.6 is cheap (~$0.01–0.02 / photo). Add a per-user daily cap (say 10 imports/day) in the Edge Function as a circuit breaker. |
| **Course-specific scorecards trip the model.** | Test set in Milestone 5 covers 3-5 different course layouts. If a layout fails consistently, we add a per-course prompt hint. |
| **Network failure mid-import loses state.** | Edge Function call is one-shot; a failure means user re-takes. Confirm grid state stays local until "Save All" — no partial writes. |
| **Apple App Store review concerns when we eventually wrap the app.** | None. Photo capture + AI processing is a common, well-understood iOS pattern. |

---

## Verification checklist (end-to-end smoke test before shipping)

After all five milestones land:

- [ ] Snap a clear photo of a scorecard for a 4-player 18-hole round → all 72 cells extracted, ≥68 green/yellow correct on first read.
- [ ] Snap a deliberately bad photo (blurry, dark) → app shows "please retake" rather than silently committing garbage.
- [ ] Edit 3 cells in the confirm grid → save → round shows the corrected scores.
- [ ] Score is persisted: refresh browser, scores still there.
- [ ] Other devices in the round see the new scores via real-time within ~1 second.
- [ ] Settle Up calculates correctly off the imported scores.
- [ ] Total time from "tap Import" to "scores saved": under 30 seconds for a clean photo.
- [ ] Tested on iPhone Safari + Android Chrome (the two real targets).

---

## What "v2" looks like (after v1 ships and we have data)

Don't build these yet — flagging so we don't paint ourselves into a corner.

- **Course import**: snap a card's header → auto-create the course with par, stroke index, yardages.
- **Round history import**: a "+ Add past round from photo" entry on the home screen for back-cataloging old cards.
- **Photo storage / audit**: optionally save the original photo so admins can verify a contested score.
- **Multi-card stitching**: some tournaments hand out separate front-9 and back-9 cards. Combine them into one round.
- **Course-specific prompt tuning**: if certain courses' cards are unreliable, store per-course OCR hints.
- **Player-name learning**: if "Mike" maps to "Michael Smith" in the system, remember that mapping for future imports.

---

## Open questions for you

1. **Which AI provider?** (D1) Default Claude — you OK with that?
2. **Confirm the entry-point placement** — Scorecard screen header menu, or somewhere more prominent?
3. **Per-user daily import cap** — start at 10/day or no cap?
4. **OK to skip photo storage in v1?** It's the cheapest decision but means we can't audit a contested import after the fact.
5. **Test set sourcing** — do you have 10-20 real scorecards we can photograph, or should we use synthetic examples for prompt tuning?

Once those are answered, I can kick off Milestone 1.

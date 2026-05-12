# Photo-Import Test Corpus

Test cards for tuning the photo-to-scorecard prompt. Each subfolder is one test case.

> **Photos and answers are gitignored** — they contain real player names from real
> rounds. Only the sample/ folder and this README are committed.

---

## Adding a test case

1. Create a numbered folder: `tests/scorecard-photos/01/`, `02/`, etc.
2. Drop the scorecard photo in as `photo.jpg` (or `.png`, `.heic` — the harness sniffs).
3. Create `answer.json` with the structure shown in `sample/answer.json`. Fill in:
   - **description**: anything helpful — course, conditions, what makes this card hard.
   - **players**: the player names as they appear on the card (or in the round). Use fake IDs like `p1`, `p2` — they're just for joining.
   - **coursePars**: par for each hole.
   - **expectedScores**: the actual correct scores per player per hole. Use `null` for holes that weren't played (blank cells).

4. Run the batch harness from the repo root:
   ```
   ANTHROPIC_API_KEY=sk-ant-... node scripts/test-photo-accuracy.mjs
   ```

The harness reports per-card accuracy, overall accuracy, and confidence calibration.

---

## What "good" looks like

We're aiming for:
- High-confidence cells: ≥99% correct
- Overall cells: ≥95% correct
- Confidence calibration is honest (model isn't confidently wrong)

If the harness shows the model is confidently wrong on multiple cards, the prompt
needs a tweak. The canonical prompt lives in two places (keep in sync):

- `supabase/functions/import-scorecard-photo/prompt.ts` — production
- `scripts/test-photo-import.mjs` — local inlined copy

A future cleanup would extract the prompt into a single shared file.

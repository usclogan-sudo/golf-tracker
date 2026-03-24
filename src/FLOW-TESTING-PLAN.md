# Flow Testing Plan: Start Game → Add Users → Money Collection

## Flows Under Test

1. **NewRound** — casual game creation (1–6 players, single group or auto-grouped)
2. **EventSetup** — organized event (multi-group, scorekeepers, invite code sharing)
3. **JoinRound** — joining via invite code (URL, notification, or manual entry)
4. **BuyInBanner** — in-round payment prompt for non-treasurer players
5. **SettleUp** — post-round money settlement and confirmation

---

## Persona Walkthroughs

### Scenario A: Dave (#1, Organizer) creates a 16-player event, Maya (#4) and Stan (#10) join

**Dave creates the event (EventSetup)**

| Step | Action | Pro | Con |
|------|--------|-----|-----|
| 1. Name | Types "Saturday Scramble" | Simple, one field, clear CTA | No validation feedback until Next — empty name just disables button silently |
| 2. Course | Taps "Ventura CC" from NearMeCourses | GPS-based picker is fast for regulars | If GPS is off or slow, Dave sees an empty list first; no loading indicator for NearMeCourses |
| 3. Players | Selects 16 from profiles + quick-adds guests | Recent friends tier avoids scrolling through everyone; quick-add is inline | At 16 players Dave must scroll a lot; no "select all" or bulk import; quick-added guests aren't saved to DB until event creation — if app crashes on review step, guests are lost |
| 4. Groups | Auto-assigned to 4 groups of 4 | Auto-assign works immediately; per-player move buttons are clear | With 16 players across 4 groups, the screen is very long; no drag-and-drop; scorekeeper dropdown is per-group — 4 separate taps; easy to miss assigning a scorekeeper for one group |
| 5. Game | Picks Skins, sets $20 buy-in, selects treasurer | Game rules "?" modal is helpful; treasurer list is on same page | Treasurer is buried below game config and buy-in — Dave has to scroll past game-specific settings to find it; no visual separation between "game settings" and "admin settings" |
| 6. Review | Checks everything, taps "Create Event & Start" | Clear summary with group breakdowns; blue "players join via invite code" hint | No edit-in-place — if Dave sees a wrong group assignment, he has to go all the way back to step 4; pot amount shown but individual buy-in status is not (all start unpaid) |
| 7. Share | Copies invite code, texts to group chat | Share API integration works well; fallback clipboard copy works | Code is 6 chars but there's no shareable link shown — Dave has to explain "open the app and type this code" vs a one-tap URL |

**Dave's verdict:** "Works but creating a 16-player event is a 3-minute process. I wish I could import my usual player list."

---

**Maya (#4, Self-entry) joins via invite code**

| Step | Action | Pro | Con |
|------|--------|-----|-----|
| 1. Code | Opens app, taps Join, types code Dave texted | Input auto-uppercases, strips junk chars | Maya has to manually switch to the app — no deep link from the text message; if Dave sent "Join with ABC123" Maya has to visually parse the code |
| 2. Pick | Sees 16 players, finds her name | Group badges (G1, G2...) help orientation | 16 players is a long list with no search/filter; she has to scroll to find "Maya Torres"; no alphabetical sort — order is whatever Dave added them in |
| 3. Info | Sees "You're In!" card — Group 2, scorekeeper is Rick | Clear role explanation: "Your scores will be submitted for approval" | Maya still doesn't understand WHY scores need approval (no explainer); she might not read this card and just tap "Start Scoring" |
| Scorecard | Enters her score, sees "PENDING" badge | Badge is visible | "PENDING" is unexplained — matches Maya's known pain point; no tooltip or first-time explainer; the approval/rejection toast appears but only if the Scorecard is open when it happens |

**Maya's verdict:** "I entered my score but it says pending and nobody told me why. I'll just text Rick to ask."

---

**Stan (#10, Occasional) joins for the first time in 2 months**

| Step | Action | Pro | Con |
|------|--------|-----|-----|
| 0. Opens app | Forgot password, re-auths | Supabase email/password with autoconfirm | No password reset flow mentioned — Stan may be stuck; if he creates a new account, his old player history is gone |
| 1. URL join | Taps `?join=CODE` link from text | Code stored in sessionStorage, replayed after auth/onboarding | If Stan clears browser data or the sessionStorage key collides, the code is lost and he has to re-enter manually |
| 2. Pick | Sees player list | "Already claimed" badges prevent wrong picks | If Dave added Stan as a guest (not linked to his user profile), Stan sees his name but it might not be linked to his account — he'd be scoring as a "guest" with no history |

**Stan's verdict:** "I got in but I'm not sure if my scores from last time are connected to this account."

---

### Scenario B: Connor (#5, Stats Bro) creates a 4-player skins game with side bets

**Connor creates the round (NewRound)**

| Step | Action | Pro | Con |
|------|--------|-----|-----|
| 1. Course | Picks from recent/saved | Fast — one tap | No issue |
| 2. Players | Selects 3 friends from recent friends tier | Perfect — recent friends shows exact people | No issue for 4 players |
| 3. Groups | Skipped (≤5 players) | Smart skip, no wasted tap | No issue |
| 4. Game | Picks Skins ($20), enables Junk ($2/each), adds custom side bets later | Quick Pick presets speed this up; junk toggle is discoverable | Junk config is "enable/disable" with preset values — no per-junk customization (e.g., $5 for Greenie, $1 for Sandy); side bets can only be added during the round, not during setup |
| 5. Money | Picks himself as treasurer, marks 2 friends paid (Venmo'd already), 1 unpaid | Payment status toggle is clear; "Start anyway" escape hatch works | Marking pre-paid players requires individual taps — no "all paid" button; Connor has to remember who Venmo'd him before the round (no notification that someone sent money) |

**Connor on the course:**

| Moment | Pro | Con |
|--------|-----|-----|
| Score entry | 2 taps: hole number → score stepper | Fast enough for Connor's pace |
| Side bet creation | Accessible from scorecard menu | Side bets are per-hole — Connor wants to bet on "longest drive on 12" but the UI doesn't support non-hole bets |
| Checking game status | Skins panel shows running tally | No "projected payout" — Connor has to do math himself on carryovers |
| Nassau press | Available during round | No issue |

---

**SettleUp after the round:**

| Step | Pro | Con |
|------|-----|-----|
| Open SettleUp | Settlements auto-computed on first view | Slight delay on first load (9 parallel fetches + computation); no indication this is happening — the spinner shows but doesn't explain "calculating..." |
| "You collect $45" summary | Clear top-level number; breakdown by game/junk/side bets | Individual settlement reasons are hidden behind expand arrows — Connor wants the detail upfront |
| Collection checklist | Per-player amounts with payment links | The "Nudge" button copies text to clipboard but doesn't send — Connor has to paste into a message app; no in-app notification to the debtor |
| Payment confirmation | "Mark Paid" toggle per counterparty | Two-tap flow (mark paid → banner updates) works but there's no confirmation "Are you sure?" — Connor could fat-finger and mark someone paid who hasn't paid |

**Connor's verdict:** "Numbers are right but I wish I could see the full breakdown without tapping expand on every settlement."

---

### Scenario C: Rick (#3, Scorekeeper) enters scores for his 4-player group

| Step | Action | Pro | Con |
|------|--------|-----|-----|
| Join | Uses invite code Dave gave him | Gets "You're In!" card saying he's the scorekeeper | Clear role assignment |
| Scoring | Enters scores for all 4 players, hole by hole | Score stepper is usable; batch entry available | On Rick's Galaxy S23 with large font, 4 player score rows barely fit on screen; stepper +/- buttons are small (40px); no "confirm scores for this hole" — Rick can't tell if he successfully saved; the score status "APPROVED" auto-applies for scorekeeper but Rick doesn't know that |
| Approval | Rick's scores auto-approve; other groups' self-entered scores show in approval panel | Approval panel is clearly labeled | Rick might not realize other players' scores are pending HIS approval; the approval panel only shows if `canApproveScores` and `pendingScores.length > 0` — it appears/disappears unpredictably |
| Between holes | Rick reviews what he entered | Per-hole breakdown visible | No "undo last entry" — if Rick enters 7 instead of 4 for a player, he has to navigate back to that hole and correct; no edit confirmation |

**Rick's verdict:** "I can use it but I'm nervous I fat-fingered something and there's no easy way to double-check before we finish."

---

### Scenario D: Pat (#7, Treasurer) does settlement after a 20-player event

| Step | Pro | Con |
|------|-----|-----|
| Open SettleUp | All settlements pre-computed | 20 players × multiple game types = long settlement list; heavy page — Pat's iPhone 12 may lag |
| Buy-in status check | Red "N unpaid" warning is prominent | Pat has to scroll through 20 players to find who hasn't paid; no sort by unpaid-first |
| Collection checklist | Per-counterparty amounts, "Mark All Paid" button | With 20 players, Pat might have 15+ counterparties to manage; no bulk "Mark All Paid" across everyone; progress bar helps but doesn't show who's remaining |
| Payment hints | "via Venmo @handle" shown per player | Not all players have payment info — Pat sees "no payment method" for guests and has to figure it out himself |
| Share Results | Captures screenshot image | Image capture (html2canvas) is slow on Pat's phone; the image doesn't include settlement status — just scores |
| Done | "Done" goes home | Pat can re-open from Round History later, but the settlement state (who's paid) is preserved — good |

**Pat's verdict:** "I need a simpler view. Just show me who still owes money and how to reach them."

---

### Scenario E: Jess (#2, Brand new) and Tomoko (#6, Beginner) join their first round

**Jess (tech-savvy, impatient):**

| Step | Pro | Con |
|------|-----|-----|
| Opens invite link | Auto-redirects through auth → onboarding → JoinRound | Smooth if it works; sessionStorage preserves code | If onboarding has multiple steps (name, handicap, tee), Jess doesn't know what values to enter; "handicap index" means nothing to her |
| Join | Picks her name, joins instantly | Non-event round skips the info card — she's on the scorecard in 3 taps from the link | No "what do I do now?" hint on the scorecard; Jess sees 18 holes of zeros and has to figure out the UI |
| Score entry | Taps score stepper | Minimal and clean | Jess doesn't know if she should enter gross or net — no label saying "Enter your actual stroke count" |

**Tomoko (UX designer, golf newbie):**

| Step | Pro | Con |
|------|-----|-----|
| Spectator mode | Can view scorecard as read-only | Good passive engagement | "Spectating" badge is small; there's no explanation of what she's seeing (Skins, carryovers, etc.) |
| Joining a round | Types code, sees player list | Clear flow | If Tomoko isn't in the player list (she's spectating, not playing), there's no "spectate only" option — she'd have to open the scorecard as read-only via a shared link or being added as a player with 0 buy-in |
| Terminology | — | SI, Net, Gross, Nassau, Carryover — all unexplained in the scoring UI; no contextual help tooltips |

---

## Summary: Pros and Cons by Flow

### Starting a Game (NewRound / EventSetup)

**Pros:**
- Smart defaults: auto-grouping, GPS course picker, recent friends tier
- Flexible: points mode, $0 buy-in, and "start anyway" escape hatch keep things moving
- Step indicator (NewRound) gives clear progress sense
- Game rules modals educate without blocking
- Quick-add guest players keeps the flow in-app

**Cons:**
- No player list import/save for recurring groups (Dave's pain)
- Quick-add guests are volatile — lost on crash before creation
- Treasurer selection is buried and missable (EventSetup step 5)
- No edit-in-place on the Review screen — must go back step-by-step
- No "select all" or group management shortcuts for large player counts
- No separate scorekeeper assignment step for NewRound (only Events have this)

### Adding Users (JoinRound)

**Pros:**
- Invite code input is clean, auto-formatting, and validates on length
- URL parameter join flow is seamless when it works
- Already-joined state is clearly communicated
- Event join shows useful context (group, scorekeeper, scoring rules)

**Cons:**
- No shareable deep link from EventSetup share screen (code only, not a URL)
- Player list for 16+ players has no search or alphabetical sort
- Regular round join skips the info card — user lands on scorecard with no context
- "PENDING" score status has no explainer for first-time users
- Guest players (not linked to accounts) have no account-linking flow
- No "wrong code" → "try again" is fine, but no "round has ended" messaging

### Money Collection (BuyIn + SettleUp)

**Pros:**
- Payment method links (Venmo/Zelle/CashApp/PayPal) are deep-linked — one tap to pay
- BuyInBanner is persistent and non-dismissable — players can't ignore it
- "Did you complete the payment?" confirmation prevents false reports
- Settlement computation handles multiple game types + junk + side bets in one unified view
- Treasurer has full control: mark paid, nudge, recalculate
- Collection checklist with progress bar gives clear state

**Cons:**
- Settlements are computed lazily (first SettleUp view), not on round end — if treasurer never opens SettleUp, settlements don't exist
- No push notification to debtors — "Nudge" copies text to clipboard, doesn't send
- Buy-in status list for 20 players isn't sorted by unpaid-first
- No bulk "Mark All Paid" across all counterparties
- No "Are you sure?" on Mark Paid — irreversible (no undo)
- Settlement detail is hidden behind expand arrows — requires per-row taps
- BuyInBanner doesn't show for guest players (no `round_participants` row)
- No recurring money tracking across rounds — each round is standalone
- Screenshot share doesn't include settlement/payment status
- Large events: SettleUp page is heavy (9 parallel fetches + html2canvas) — slow on older phones

---

## Priority Issues (Ranked by Drop-off Risk)

1. **No shareable join link** — Dave texts a code and players have to type it manually. Biggest friction point for getting new users in.
2. **"PENDING" unexplained** — Maya and every self-entry player will be confused. Needs a one-time tooltip or onboarding card.
3. **Treasurer buried in EventSetup** — Dave could miss it and get blocked on Review.
4. **No push/in-app nudge** — Pat has no way to remind people to pay from within the app.
5. **Player list unsorted/unsearchable at 16+ players** — JoinRound becomes a scroll-hunt.
6. **Guest player account-linking gap** — Stan's recurring pain: guest history disconnected from account.
7. **Lazy settlement computation** — if nobody opens SettleUp, money data doesn't exist.
8. **No "undo" or "are you sure" on Mark Paid** — Pat could fat-finger and lose track.

# Gimme — Native App Developer Brief

**For the team building the iOS & Android apps**

Prepared by: Head of Brand · Date: May 31, 2026 · v1.0

---

## 1. What Gimme is

Gimme lets a group of golfers run their side games (Skins, Nassau, Wolf, Best Ball, Bingo Bango Bongo) and, at the end of the round, see **who owes who** — automatically. It replaces the paper scorecard *and* the hour of post-round math.

**It is a settlement *tracker*, not a money-mover.** The app calculates the result; it does **not** process, hold, or transfer money. This is a deliberate product and compliance decision (see §5). Treat "no money movement" as a hard MVP boundary.

The brand is a premium "social club" lifestyle brand that happens to launch as an app — design and polish matter more than feature count.

---

## 2. MVP scope (build this)

- **Round setup:** pick course, players (any group size — 4, 5, or several foursomes as one event), games, stakes, handicaps.
- **Games:** Skins, Nassau, Wolf, Best Ball, Bingo Bango Bongo — with presses and common variants. Net/gross via handicap.
- **Roles:** **Treasurer** (owns the result) and **Game Master** (runs the games) — proprietary, keep the names.
- **Live scoring & standings:** track as you play; everyone sees where they stand.
- **Settlement engine:** zero-sum, to the penny; produce the who-owes-who lines.
- **The result card:** a premium, shareable post-round summary (the single most important growth feature — see §6).
- **Join by code, guest mode, spectator/follow, multi-group events, course catalog, history/stats.** (Parity with the existing PWA.)

There is an existing PWA (React) and backend (auth, cloud sync, scoring, settlement) — **use it as the functional reference and, where possible, the shared backend.** Don't reinvent the settlement logic; port/validate it.

---

## 3. Out of scope for MVP

- **Money movement / payments.** No in-app transfer, escrow, or processing. (Future: optional deep-links to Venmo/PayPal/etc. to *hand off* a pre-filled amount — a later phase, behind counsel review.)
- Anything that would make the app a wagering/gambling product (see §5).

---

## 4. Platforms & technical notes

- **iOS and Android, native-quality.** Cross-platform (React Native / Flutter) is acceptable and may reuse the existing React/PWA logic; native (SwiftUI / Kotlin) is fine if the team prefers. Team's call — optimize for a fast, native-*feeling*, effortless experience.
- **Ease of use is the design law.** Setup in seconds; first settlement without a manual. Cut complexity ruthlessly. This is a core value proposition, not a nicety.
- Offline-tolerant scoring with cloud sync (the PWA already does this).
- App icon: adaptive (Android) / 1024 master no baked corners (iOS), from the supplied seal.

---

## 5. CRITICAL — app-store positioning & compliance

The category leader ships as "Gambling Golfer LLC" with an **18+ "Contains Gambling"** rating, which caps mainstream distribution. **Gimme must not inherit that.** Build and describe the app as a **scorekeeping + settlement utility**, targeting a mainstream age rating.

- **No money flows through the app** in MVP — this is what keeps it a tracker, not a gambling product.
- **Store listing & in-app copy:** minimize "bet / wager / gamble / winnings / money." Use "side games / scores / settle up / the result." Lead with *settlement tracking*, not betting.
- Follow Apple App Store and Google Play **real-money-gaming policies**; this app should fall outside them by design, but confirm during review prep.
- **Legal gating:** a trademark clearance opinion on "Gimme" is in progress (a live "GIMME" software mark and an active "Gimme" golf company exist) — confirm name status with the founder before store submission. Any future money-movement feature requires gaming counsel before build.

---

## 6. The result card (treat as a flagship feature)

After every round, generate a **premium, shareable result card** — this is the brand's primary growth engine (it gets screenshotted into group chats). Requirements:
- Renders to a portrait/story image for native share sheets.
- Carries the full brand: navy + cream + brass, the signet seal, the serif headline, the "THAT'S GOOD." sign-off.
- Shows: winner headline, a tasteful auto-generated wit line, standings (net +/−), and the settle-up lines.
- Must look designed, not auto-generated. Pixel quality here directly drives acquisition.

---

## 7. Brand & design system (handoff)

- **Palette:** navy `#16263B`, cream `#F2ECDD`, brass `#C2A24C`, slate `#2E4257`. Volt `#C6F24E` is **apparel-drop only** — never in the app.
- **Type:** high-contrast serif (Didone-style; Playfair Display as interim) for the wordmark/headlines; Inter for UI.
- **Marks:** the oval signet **G** seal (icon, small spaces) and the **GIMME** serif wordmark (tracked). Full brand guidelines and the verbal/voice system to be supplied separately.
- **Voice:** premium but playful — "confident and considered, with a wink." Warmth + clarity for functional/newcomer/money moments; confident wit only at the win. Inclusive, cross-gender — never "guys/boys."
- **Cross-gender is a requirement**, in imagery, copy, and feel.

---

## 8. Success criteria

- A new user completes setup and reaches a first settlement **without help**.
- The result card is good enough that groups share it unprompted.
- The app reads **premium and trustworthy** — never sketchy, never gambling-coded.
- Mainstream age rating achieved on both stores.

---

## 9. Open items to confirm with the founder before build

- Final name/trademark status ("Gimme").
- Shared backend vs. new — reuse the existing PWA backend if viable.
- Cross-platform vs. native decision and timeline.
- Which games are must-have for v1 vs. fast-follow.

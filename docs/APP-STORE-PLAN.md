# Plan: Bringing Gimme to the App Store

A non-technical walkthrough of what it takes to get Gimme into Apple's App Store and Google Play. Covers the options, costs, timeline, and what you'd need to do (and what your developer would do).

> **Last updated:** May 2026

---

## Where we are today

Gimme is currently a **Progressive Web App (PWA)**. That means:
- It runs in the browser at a public URL.
- Users on iPhone or Android can "Add to Home Screen" and it behaves almost like an installed app — full-screen, icon, offline support.
- No app store review, no install friction.
- 100% free to host.

**But:** people still have to find the URL, and "Add to Home Screen" is a hidden feature that 90% of users will never discover. Being in the official stores legitimizes the product and is how 95% of people actually install apps.

---

## The three paths to the App Store

### Option A: Wrap the existing app (recommended for first launch)

**What it is:** A thin native shell wraps the existing Gimme web app. From the user's perspective, it looks and feels like a real app. Behind the scenes, it's still our web code — meaning every fix and feature we ship online lands in the app instantly without needing a new App Store update.

**Tool:** Capacitor (or PWABuilder for a quick first pass).

**Pros:**
- Fastest path. **5–10 days of developer work** for a polished first submission.
- Reuse 100% of the code we already have.
- Push notifications, biometric login, Apple Pay etc. can be layered in later.
- One codebase keeps website + app in lockstep.

**Cons:**
- Apple is occasionally fussy about apps that are "just" a wrapped website. To pass review reliably we'll add at least one **native-only feature** — push notifications or share-sheet integration is the cheapest way to clear that bar.
- Performance is great but not native-perfect. For a scorecard app, indistinguishable.

**Total cost:** $99 Apple Developer / year + $25 Google Play (one-time) + ~10 days of dev work.

---

### Option B: PWABuilder (Microsoft's free tool)

**What it is:** Microsoft's free service that takes a PWA URL and outputs ready-to-submit Android (and basic iOS) packages. The fastest possible path.

**Pros:**
- **2–3 days** of work if everything goes smoothly.
- Free tooling.
- Excellent for Google Play.

**Cons:**
- Apple side is rougher; you'll likely still drop into Capacitor for iOS.
- Less flexibility for native add-ons later.

**Total cost:** Same store fees + ~3 days of dev work.

---

### Option C: Full native rewrite (long-term play, not now)

**What it is:** Rewrite the app in React Native (or Swift / Kotlin natively).

**Pros:**
- True native performance, full access to platform features (Apple Watch, HealthKit, deep iOS integrations).
- The "right" answer if Gimme becomes a serious commercial product 1-2 years from now.

**Cons:**
- **2–4 months** of work minimum.
- Doubles your maintenance going forward (web app + native app, two codebases).
- Almost no user-visible benefit for a scorecard app today.

**Recommendation:** Don't do this for v1. Revisit in year 2 if the product takes off.

---

## My recommendation

**Go with Option A (Capacitor).** It's the right balance of speed, cost, and flexibility. Here's the breakdown:

| Phase | What happens | Time | Who does it |
|---|---|---|---|
| 1. Prep | Buy Apple Developer ($99/yr), buy Google Play developer ($25 once), set up signing keys, create app icons in 18 sizes, capture 5–10 screenshots per device size | 1–2 days | You + designer (icons) |
| 2. Wrap | Add Capacitor to the project, set up iOS + Android shells, configure deep linking for invite URLs (so `?join=ABC123` opens the app, not the browser), add push notifications | 3–5 days | Developer |
| 3. Polish | Splash screens, app icon, "What's New" copy, App Store description, privacy policy URL, terms of service URL | 2–3 days | You + developer |
| 4. Submit | Upload binaries via Xcode + Android Studio, fill out App Store Connect / Play Console listings, submit for review | 1 day | Developer |
| 5. Review | Apple: 1–7 days. Google: 1–3 days. Be ready for one rejection cycle on Apple side; have answers ready about why this isn't "just a website" | 1–2 weeks | Apple/Google |
| 6. Launch | Approval → live in stores | — | Apple/Google |

**Realistic end-to-end:** **3–5 weeks** from "let's start" to "live on both stores."

---

## What you'll need (the boring but mandatory list)

### Legal
- **Privacy Policy** — required by both stores. Should explain what data Gimme collects (email, scores, payment handles), how it's used, and how to delete an account. Generic generators like Termly or Iubenda work. **Cost: $0–$30/yr.**
- **Terms of Service** — also required. Same generators. **Cost: $0–$30/yr.**
- **Account deletion path** — Apple now requires apps with logins to offer in-app account deletion. Already partially built; needs a final UI button. **~half a day of dev work.**

### Accounts
- **Apple Developer Program** — $99/year. Apply with your ID; takes 24–48 hours to be approved. Required to ship to App Store.
- **Google Play Console** — $25 one-time. Faster approval (usually same-day).
- **Support email address** — required on both store listings. Make a `support@gimme.golf` or use your personal one.

### Branding assets
- **App icon** in 18 different sizes for iOS, plus Android. A designer can do this in a few hours, or use a tool like Bakery / Icon Set Creator.
- **Screenshots** — 5–10 per device size (iPhone 6.7", 6.5", 5.5", iPad if shipping there; same for Android). These are the most important sales tool in the App Store; spend real time on them. Tools like ScreenshotPro or Figma make this quick.
- **App Store description** (4000 chars) and **subtitle** (30 chars). Pull from `docs/marketing-plan.md`.
- **Promotional video** (optional but doubles install rate) — a 15–30 second screen recording of the app in action.

### Tech prerequisites we already have
- ✅ HTTPS deployment (GitHub Pages).
- ✅ Manifest file with proper icons and theme color.
- ✅ Service worker for offline support.
- ✅ Crash reporting (Sentry).
- ✅ Authentication system.
- ✅ Real-time backend (Supabase).
- ✅ Working invite link handling (the deep linking story will be a small addition).

### What we'd add for the native shell
- Push notification setup (Apple Push Notification Service + Firebase Cloud Messaging for Android).
- Native splash screen.
- Deep link handler so invite URLs open the app instead of the browser.
- One small piece of "native-only" value (likely push notifications + share-sheet integration) to clear Apple's "not just a website" bar.

---

## Costs at a glance (first year)

| Item | Cost | When |
|---|---|---|
| Apple Developer | $99 | Annual |
| Google Play | $25 | One-time |
| Privacy Policy + ToS hosting | $0–$30 | Annual |
| Developer time (Option A) | depends on rate, ~10 days of work | Once |
| App icon + screenshot design | $200–$1,000 (or DIY with Figma) | Once |
| **Total first-year out-of-pocket (excl. dev time)** | **$300–$1,200** | — |

After year 1 it drops to ~$130/year recurring.

---

## What launching to the App Store actually does for you

**Pros:**
- Discoverability — people search "golf score tracker" in the App Store, Gimme appears.
- Legitimacy — being in the App Store signals "real product" to skeptical golfers.
- Push notifications work properly on iOS (web push is restricted on iPhones).
- Native share-sheet, biometric login, deep link handling.
- Easier word-of-mouth (texting "go to gimme.golf and add to home screen" loses 90% of installs vs. "search Gimme on the App Store").

**Cons / things to be ready for:**
- App Store review can be capricious. Expect at least one rejection cycle. We'll have a clear "this isn't just a website, here's the native value" story ready.
- Updates require resubmission (1-3 day approval), so urgent bug fixes still go through web (which the wrapped app picks up automatically — that's the magic of the Capacitor approach).
- Apple's 30% cut applies if you ever add paid in-app subscriptions or one-time IAP. Doesn't apply to the current free model or to external payment links (Venmo, etc.).

---

## What I'd do next

1. **Decide:** are you ready to commit ~$1,000 + 10 days of dev work in the next month?
2. **If yes:** sign up for the Apple Developer program today (24–48hr approval). Buy Google Play developer access ($25). I'll set up the Capacitor wrapper, the icon pipeline, and the privacy policy URL while that's in flight.
3. **If no, but interested:** keep using the PWA. The marketing plan in `docs/marketing-plan.md` has 100-user growth tactics that don't require app stores.

---

## Open questions you'd want to answer before signing up

- **App name in the store** — "Gimme" is taken in the App Store by other apps. Likely needs to be "Gimme Golf" or similar. Check availability before printing icons.
- **Account deletion UX** — minor UX work; add a "delete my account" button under Settings.
- **Push notifications** — what are the 3-4 events we'd notify on? Score approval, settlement requests, round invites, event start.
- **Pricing model** — staying free? Freemium with paid tournaments? Subscription? Affects App Store positioning materially.

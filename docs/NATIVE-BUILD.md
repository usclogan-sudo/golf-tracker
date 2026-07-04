# Gimme — Native app build (Capacitor)

The native iOS & Android apps wrap the **existing React PWA + Supabase backend** via
[Capacitor](https://capacitorjs.com). Nothing about the web app or backend changed —
the same `dist/` bundle runs inside a native shell, talks to the same Supabase, and
reuses the offline queue, game logic, invite flows, token mode, everything.

Bundle / package id: **`com.gimme.golf`** (matches `public/.well-known/`).

## What's already set up (in this repo)
- `capacitor.config.ts` — appId, navy splash/status bar, https scheme, plugin config.
- `ios/` and `android/` — native Xcode + Android Studio projects (checked in; build
  artifacts are gitignored).
- App icons + splash for both platforms, generated from the brand seal on navy
  (`assets/logo.png` is the source; regenerate with `npx capacitor-assets generate`).
- `src/lib/native.ts` — native-only init: status bar, splash hide, **deep-link routing**
  (Universal/App Links → the app's existing `?join=` / `?spectate=` flow), and **push
  registration**. No-op on web.
- Service worker is disabled in the native shell (Capacitor serves assets locally).
- Plugins installed: `@capacitor/app`, `status-bar`, `splash-screen`, `keyboard`,
  `push-notifications`, `camera`.

## Dev workflow (every time the web app changes)
```bash
npm run build          # produce dist/
npx cap sync           # copy web + update native deps
npx cap open ios       # opens Xcode
npx cap open android   # opens Android Studio
```

## Prerequisites (your machine)
- **Full Xcode** (not just Command Line Tools) for iOS.
- **Android Studio** + JDK 17 for Android.
- **Apple Developer Program** membership ($99/yr) — signing + App Store Connect.
- **Google Play Console** account ($25 one-time).

---

## iOS — first build & submit
1. `npx cap open ios` → Xcode.
2. **Signing & Capabilities** → select your Team; set the bundle id to `com.gimme.golf`.
3. Add capability **Associated Domains** → `applinks:app.gimme.golf` (or your prod domain).
   This creates `App.entitlements`.
4. Add capability **Push Notifications** (and **Background Modes → Remote notifications**).
5. Run on a simulator/device to smoke-test. Then **Product → Archive** → distribute to
   **App Store Connect**.

## Android — first build & submit
1. `npx cap open android` → Android Studio.
2. Create a **release signing key** (`keytool`) and add a `signingConfig` in
   `android/app/build.gradle`.
3. Build → **Generate Signed Bundle (.aab)** → upload to **Play Console**.
4. Note the signing cert's **SHA-256** — you need it for `assetlinks.json` (below).

## Deep links — finish the `.well-known` files
`public/.well-known/` currently ships **stubs**. Replace and redeploy on the prod domain:
- `apple-app-site-association`: replace `PLACEHOLDER_TEAMID.com.gimme.golf` with your real
  **Apple Team ID** + bundle id. (Already served as `application/json` via `vercel.json`.)
- `assetlinks.json`: replace the `sha256_cert_fingerprints` placeholder with your Android
  release signing cert's SHA-256.
Apple/Google fetch these from `https://<domain>/.well-known/…` to verify link ownership.

## Push notifications — finish the delivery path
Registration is wired (`src/lib/native.ts` → `initPush`), but tokens aren't stored/sent yet:
1. **iOS:** create an **APNs Auth Key** (.p8) in the Apple Developer portal.
2. **Android:** create a **Firebase** project, add the Android app, drop
   `google-services.json` into `android/app/`, and enable the FCM plugin wiring.
3. Persist the device token: add a `device_tokens` table (user_id, platform, token) and
   have the `registration` listener upsert it.
4. Send: a Supabase Edge Function that, on invite / settlement-nudge / scorekeeper-approval,
   looks up tokens and calls APNs/FCM. (Mirror the existing in-app `notifications` writes.)

## Store listing / compliance (from the MVP positioning)
- Lead copy with **side games · scores · settle up**; minimize bet/wager/gamble/money.
- Target a **mainstream age rating** (4+/12+), not 18+ gambling — the app links out to
  payment apps and never moves money (token/points mode reinforces this).
- Icons/screenshots/brand: navy/cream/brass, Playfair + Inter (assets in
  `docs/brand/gimme-brand-handoff/`).
- Confirm the **"Gimme" trademark** before submission.

## Optional native enhancement — camera for photo import
`@capacitor/camera` is installed. The photo-import UI uses a web `<input type=file>` which
works inside the webview; swapping to `Camera.getPhoto()` on native gives a nicer picker.
Low priority — the current flow already works in the shell.

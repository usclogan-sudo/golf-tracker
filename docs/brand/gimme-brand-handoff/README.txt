GIMME — BRAND HANDOFF
=====================
For the iOS app developer. Start with the PDF; everything else is the source
files it references.

Gimme-Brand-Guidelines-iOS.pdf
    The brand + iOS implementation reference (10 pages). Fonts are embedded,
    so it renders correctly anywhere. Read this first.

icons/
    icon-1024.png          App Icon master — drop into Xcode's AppIcon asset
                           (full-bleed navy, NO rounded corners; iOS masks them).
    icon-1024-master.svg   Vector source for the master, if you need to re-export.
    icon-512.png           PWA / general use.
    icon-192.png           PWA / general use.
    icon-maskable-512.png  Android/adaptive maskable (seal inside the safe zone).
    apple-touch-icon.png   180px, for the PWA.

mark/
    seal.svg               The oval signet — vector source of truth. Use for the
                           in-app mark, headers, and the result-card stamp.

web-components/
    Seal.tsx               React reference components (used in the PWA). Treat as
    Wordmark.tsx           the spec for the native SwiftUI equivalents — they
                           encode the exact geometry, tones, and tracking.

fonts/
    PlayfairDisplay.ttf    Display serif (variable; use 700–900 for the wordmark
                           and headlines). SIL OFL — free to bundle & ship.
    Inter-Regular/Medium/SemiBold/Bold.otf
                           UI & body. SIL OFL — free to bundle & ship.
    Register the weights you use in Info.plist -> UIAppFonts, then load via
    Font.custom (see the Typography page of the PDF).

Palette (also on the Color page, with a paste-ready SwiftUI extension):
    navy  #16263B   cream #F2ECDD   brass #C2A24C   slate #2E4257
    volt  #C6F24E   apparel only — NEVER in the app, icon, or marketing.

Questions on intent: the result card is the priority surface — build it as a
first-class native view. Design against the guardrails on page 08.

import type { CapacitorConfig } from '@capacitor/cli';

// Gimme native shell (Capacitor) — wraps the existing React PWA + Supabase backend.
// Bundle IDs match public/.well-known (com.gimme.golf) so Universal/App Links verify.
const config: CapacitorConfig = {
  appId: 'com.gimme.golf',
  appName: 'Gimme',
  webDir: 'dist',
  // https scheme keeps localStorage/cookies + Supabase auth consistent with the web app.
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    // 'automatic' lets the webview scroll view respect top/bottom safe areas so
    // content isn't trapped under the notch / home indicator. (The app also adds
    // its own env(safe-area-inset-*) padding on headers.)
    contentInset: 'automatic',
    backgroundColor: '#16263B',
  },
  android: {
    backgroundColor: '#16263B',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#16263B',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#16263B',
    },
    Keyboard: {
      resize: 'native',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

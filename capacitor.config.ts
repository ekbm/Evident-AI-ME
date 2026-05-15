import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.evident.ai.assistant',
  appName: 'Evident-AI Assistance',
  webDir: 'dist/public',
  server: {
    url: 'https://evident-ai.net',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'evident-ai.net',
    allowNavigation: [
      'evident-ai.net',
      '*.evident-ai.net',
      'replit.com',
      '*.replit.com',
      '*.repl.co',
      'auth.replit.com',
      'replit.dev',
      '*.replit.dev',
      'api.openai.com',
      '*.stripe.com',
      '*.firebase.com',
      '*.googleapis.com',
      '*.google.com'
    ]
  },
  ios: {
    contentInset: 'never', // CSS handles safe areas via env() - avoid double padding
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    allowsLinkPreview: false,
    backgroundColor: '#f8fafc',
    webContentsDebuggingEnabled: true, // Enable for debugging
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#f8fafc",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      iosSpinnerStyle: "small",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "light",
      backgroundColor: "#f8fafc",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;

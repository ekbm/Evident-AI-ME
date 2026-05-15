import { initializeApp, FirebaseApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, Analytics, logEvent as firebaseLogEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let initialized = false;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export function initializeFirebase(): void {
  if (initialized) return;
  
  const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId;
  
  if (!hasConfig) {
    console.log('Firebase not configured - analytics disabled');
    initialized = true;
    return;
  }

  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    
    if (!Capacitor.isNativePlatform()) {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics initialized (web)');
    } else {
      console.log('Firebase Analytics: Using web SDK on native platform');
    }
    initialized = true;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    initialized = true;
  }
}

export async function logEvent(eventName: string, params?: Record<string, unknown>): Promise<void> {
  try {
    if (analytics) {
      firebaseLogEvent(analytics, eventName, params);
    } else {
      console.log('Analytics event:', eventName, params);
    }
  } catch (error) {
    console.error('Analytics logEvent error:', error);
  }
}

export async function setAnalyticsUserId(userId: string | null): Promise<void> {
  try {
    if (analytics) {
      setUserId(analytics, userId);
    }
  } catch (error) {
    console.error('Analytics setUserId error:', error);
  }
}

export async function setAnalyticsUserProperties(properties: Record<string, string>): Promise<void> {
  try {
    if (analytics) {
      setUserProperties(analytics, properties);
    }
  } catch (error) {
    console.error('Analytics setUserProperties error:', error);
  }
}

export async function logCrash(message: string, error?: Error): Promise<void> {
  console.error('Crash logged:', message, error);
}

export async function setCrashlyticsUserId(userId: string | null): Promise<void> {
  console.log('Crashlytics userId set:', userId);
}

export async function clearAnalyticsUser(): Promise<void> {
  await setAnalyticsUserId(null);
  await setCrashlyticsUserId(null);
}

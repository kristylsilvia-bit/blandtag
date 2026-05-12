'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Public Firebase web-app config — these are not secrets, they identify the
// project publicly. Same project as Visionary AI so users + credits are shared.
// Override via NEXT_PUBLIC_FIREBASE_* env vars if needed.
const FIREBASE_CONFIG = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyBCWsmKnucmlkdfYxFL7pWktK6obNl3GeU',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'bhbingo-3901f.firebaseapp.com',
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bhbingo-3901f',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'bhbingo-3901f.firebasestorage.app',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '940080292095',
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    '1:940080292095:web:55e9b851909fdcac276cca',
};

const DB_ID =
  process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID ||
  'ai-studio-cf717e18-e547-4860-ae4b-893c4525cde3';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _googleProvider: GoogleAuthProvider | null = null;

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getFirebaseDb(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp(), DB_ID);
  return _db;
}

export function getGoogleProvider(): GoogleAuthProvider {
  if (!_googleProvider) _googleProvider = new GoogleAuthProvider();
  return _googleProvider;
}

export const auth = new Proxy({} as Auth, {
  get(_t, prop) {
    const real = getFirebaseAuth() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export const db = new Proxy({} as Firestore, {
  get(_t, prop) {
    const real = getFirebaseDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export const googleProvider = new Proxy({} as GoogleAuthProvider, {
  get(_t, prop) {
    const real = getGoogleProvider() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

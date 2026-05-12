'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const DB_ID =
  process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID ||
  'ai-studio-cf717e18-e547-4860-ae4b-893c4525cde3';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _googleProvider: GoogleAuthProvider | null = null;

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app =
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  return _app;
}

// Lazy accessors — only initialize Firebase when first accessed at runtime,
// never at module-import time, so the page loads even before env vars are set.
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

// Proxy exports so existing code keeps working without changes.
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

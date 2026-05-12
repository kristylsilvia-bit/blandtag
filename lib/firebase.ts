'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Public Firebase web config — not secrets, identify the project publicly.
// Same Firebase project as visionary-ai so users and credits are shared.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBCWsmKnucmlkdfYxFL7pWktK6obNl3GeU',
  authDomain: 'bhbingo-3901f.firebaseapp.com',
  projectId: 'bhbingo-3901f',
  storageBucket: 'bhbingo-3901f.firebasestorage.app',
  messagingSenderId: '940080292095',
  appId: '1:940080292095:web:55e9b851909fdcac276cca',
};

const DB_ID = 'ai-studio-cf717e18-e547-4860-ae4b-893c4525cde3';

const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app, DB_ID);
export const googleProvider = new GoogleAuthProvider();

import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-cf717e18-e547-4860-ae4b-893c4525cde3';

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  return key ? key.replace(/\\n/g, '\n') : undefined;
}

function initAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  const firestoreDatabaseId =
    process.env.FIREBASE_FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing required Firebase Admin environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)',
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });

  // Register custom Firestore database so getFirestore() returns it cached
  getFirestore(admin.app(), firestoreDatabaseId);
}

export function getAdminAuth(): Auth {
  initAdmin();
  return admin.auth();
}

export function getAdminDb(): Firestore {
  initAdmin();
  const firestoreDatabaseId =
    process.env.FIREBASE_FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;
  return getFirestore(admin.app(), firestoreDatabaseId);
}

// Backwards-compatible proxy exports so existing imports keep working.
// These proxies only call initAdmin() when a property is accessed at request time.
export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    const real = getAdminAuth() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const real = getAdminDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export default admin;

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-cf717e18-e547-4860-ae4b-893c4525cde3';

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  return key ? key.replace(/\\n/g, '\n') : undefined;
}

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  const firestoreDatabaseId =
    process.env.FIREBASE_FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing required Firebase Admin environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });

  // Register custom Firestore database so getFirestore() below returns it cached
  getFirestore(admin.app(), firestoreDatabaseId);
}

const firestoreDatabaseId =
  process.env.FIREBASE_FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;

export const adminAuth = admin.auth();
export const adminDb = getFirestore(admin.app(), firestoreDatabaseId);
export default admin;

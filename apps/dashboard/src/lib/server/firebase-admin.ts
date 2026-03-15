/**
 * Firebase Admin SDK — server only. Initialize with GOOGLE_APPLICATION_CREDENTIALS (file path, e.g. Cloud Run)
 * or FIREBASE_ADMIN_* env vars. No secrets in repo.
 */
import { getApps, initializeApp, cert, applicationDefault, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0] as ReturnType<typeof initializeApp>;
  }
  // Cloud Run: secret mounted at path in GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault() });
  }
  // Env vars (e.g. local or platforms without file access)
  let cred: ServiceAccount | undefined;
  if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    cred = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    } as ServiceAccount;
  }
  return initializeApp(cred ? { credential: cert(cred) } : {});
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdmin());
}

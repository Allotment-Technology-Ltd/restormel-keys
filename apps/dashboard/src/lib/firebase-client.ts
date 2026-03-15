/**
 * Firebase client for login (GitHub). Config from env at build time. No secrets in repo.
 */
import { browser } from "$app/environment";
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID,
} from "$env/static/public";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GithubAuthProvider, type User } from "firebase/auth";

const config = {
  apiKey: PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: PUBLIC_FIREBASE_PROJECT_ID ?? "",
};

let auth: ReturnType<typeof getAuth> | null = null;

function getClientAuth() {
  if (!browser) {
    throw new Error("Firebase Auth is only available in the browser");
  }
  if (!config.apiKey || !config.authDomain || !config.projectId) {
    throw new Error("Firebase client config missing (PUBLIC_FIREBASE_* env vars)");
  }
  if (!auth) {
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    auth = getAuth(app);
  }
  return auth;
}

export async function signInWithGitHub(): Promise<User> {
  const provider = new GithubAuthProvider();
  const result = await signInWithPopup(getClientAuth(), provider);
  return result.user;
}

export async function getIdToken(): Promise<string | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

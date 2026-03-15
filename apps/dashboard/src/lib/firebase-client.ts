/**
 * Firebase client for login (GitHub). Config from env at build time. No secrets in repo.
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GithubAuthProvider, type User } from "firebase/auth";

const config = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ?? "",
};

const app = initializeApp(config);
export const auth = getAuth(app);

export async function signInWithGitHub(): Promise<User> {
  const provider = new GithubAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

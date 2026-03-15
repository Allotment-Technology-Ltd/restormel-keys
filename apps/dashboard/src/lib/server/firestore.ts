/**
 * Firestore: projects/{projectId}. API keys in projects/{projectId}/apiKeys/{keyId}.
 * No raw API keys stored; store prefix + hash only. See security-baseline.
 */
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes, createHash } from "crypto";
import { getFirebaseAdmin } from "$lib/server/firebase-admin";

function getDb() {
  return getFirestore(getFirebaseAdmin());
}

const PROJECTS = "projects";
const API_KEYS = "apiKeys";
const KEY_PREFIX = "rk_";

export type Project = {
  id: string;
  name: string;
  userId: string;
  createdAt: number;
};

export type ApiKeyRecord = {
  id: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: number;
};

/** List projects for user */
export async function listProjects(userId: string): Promise<Project[]> {
  const snap = await getDb().collection(PROJECTS).where("userId", "==", userId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
}

/** Create project; returns new project with id */
export async function createProject(userId: string, name: string): Promise<Project> {
  const ref = getDb().collection(PROJECTS).doc();
  const project: Project = {
    id: ref.id,
    name: name || "Unnamed project",
    userId,
    createdAt: Date.now(),
  };
  await ref.set(project);
  return project;
}

/** Get project; returns null if not found or not owner */
export async function getProject(projectId: string, userId: string): Promise<Project | null> {
  const ref = getDb().collection(PROJECTS).doc(projectId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== userId) return null;
  return { id: snap.id, ...snap.data() } as Project;
}

/** Update project name */
export async function updateProject(projectId: string, userId: string, name: string): Promise<boolean> {
  const ref = getDb().collection(PROJECTS).doc(projectId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== userId) return false;
  await ref.update({ name });
  return true;
}

/** Delete project (and its apiKeys subcollection) */
export async function deleteProject(projectId: string, userId: string): Promise<boolean> {
  const ref = getDb().collection(PROJECTS).doc(projectId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== userId) return false;
  const keysSnap = await ref.collection(API_KEYS).get();
  const batch = getDb().batch();
  keysSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
  return true;
}

/** Hash for storing; never store raw key */
function hashKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** List API keys for project (prefix only) */
export async function listApiKeys(projectId: string, userId: string): Promise<ApiKeyRecord[]> {
  const project = await getProject(projectId, userId);
  if (!project) return [];
  const snap = await getDb().collection(PROJECTS).doc(projectId).collection(API_KEYS).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApiKeyRecord));
}

/**
 * Create API key. Returns { rawKey } once; caller must show to user. Store only prefix + hash.
 */
export async function createApiKey(projectId: string, userId: string): Promise<{ rawKey: string; keyPrefix: string } | null> {
  const project = await getProject(projectId, userId);
  if (!project) return null;
  const rawKey = KEY_PREFIX + randomBytes(24).toString("base64url");
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12) + "…";
  const ref = getDb().collection(PROJECTS).doc(projectId).collection(API_KEYS).doc();
  await ref.set({ keyPrefix, keyHash, createdAt: Date.now() });
  return { rawKey, keyPrefix };
}

/** Revoke (delete) API key */
export async function deleteApiKey(projectId: string, keyId: string, userId: string): Promise<boolean> {
  const project = await getProject(projectId, userId);
  if (!project) return false;
  const ref = getDb().collection(PROJECTS).doc(projectId).collection(API_KEYS).doc(keyId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

/**
 * Single data layer: projects and api_keys. Uses Neon Postgres only.
 * Requires DATABASE_URL. All route handlers and load functions import from $lib/server/db.
 */
export {
  upsertUser,
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listApiKeys,
  createApiKey,
  deleteApiKey,
  type Project,
  type ApiKeyRecord,
} from "$lib/server/neon";

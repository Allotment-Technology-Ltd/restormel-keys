# Keys dashboard

SvelteKit 2 + Svelte 5 dashboard for Restormel Keys (Phase 3.4). Firebase Auth (GitHub sign-in), Firestore `projects/{projectId}`, API keys CRUD. Served at `/keys/dashboard` (base path).

## Commands

- `pnpm dev` — dev server (open http://localhost:5173/keys/dashboard)
- `pnpm build` — build for Node (adapter-node)
- `pnpm preview` — preview production build

## Routes

- `/keys/dashboard` — Overview (project list)
- `/keys/dashboard/projects` — List + create project
- `/keys/dashboard/projects/[id]` — Project detail, generate/revoke API keys
- `/keys/dashboard/projects/[id]/usage` — Placeholder (Phase 4)
- `/keys/dashboard/billing` — Placeholder (3.5)
- `/keys/dashboard/settings` — Account (user id, email)
- `/keys/dashboard/login` — Sign in with GitHub
- `/keys/dashboard/logout` — Clear session, redirect to login

## API

- `GET/POST /keys/dashboard/api/projects` — List, create
- `GET/PATCH/DELETE /keys/dashboard/api/projects/[id]` — Project CRUD
- `GET/POST/DELETE /keys/dashboard/api/projects/[id]/keys` — API keys
- `POST /keys/dashboard/api/auth/session` — Set session cookie (body: `{ idToken }`)
- `GET /keys/dashboard/api/health` — Health check

## Environment (no secrets in repo)

- **Firebase Admin (server):** `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON) or `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`
- **Firebase client (login):** `PUBLIC_FIREBASE_API_KEY`, `PUBLIC_FIREBASE_AUTH_DOMAIN`, `PUBLIC_FIREBASE_PROJECT_ID` (same project as Admin; enable GitHub sign-in in Firebase Console)

## Gate

Dashboard runs. Sign in with GitHub. Create project. Generate API key.

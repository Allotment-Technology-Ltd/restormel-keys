#!/usr/bin/env bash
# Migrate dashboard from Cloud Run to Vercel (script-assisted).
# Run from repo root. Requires: Vercel CLI (npx vercel), Neon DB + migrations done, GitHub OAuth App.
# See docs/reference/extraction-vercel.md for full checklist.

set -e
cd "$(dirname "$0")/.."

echo "=== Dashboard → Vercel migration (script-assisted) ==="
echo ""
echo "This script:"
echo "  1. Ensures dashboard uses adapter-vercel (already done if you ran the migration)."
echo "  2. Links the repo to Vercel (or creates a project) and prints env steps."
echo "  3. Does NOT push secrets to the shell; you add env in Vercel UI or via 'vercel env add'."
echo ""

# 1) Link or create project (from repo root; Vercel CLI prefers monorepo root)
# Use npx so global install is not required (avoids EACCES on npm i -g vercel)
VERCEL_CMD="vercel"
if ! command -v vercel &>/dev/null; then
  VERCEL_CMD="npx vercel"
  echo "Using: $VERCEL_CMD (no global vercel install required)."
fi

echo "Step 1: Link this repo to a Vercel project (dashboard only)."
echo "  - Run:  $VERCEL_CMD link   (or: npx vercel link)"
echo "  - When prompted, set Root Directory to:  apps/dashboard"
echo "  - Create a new project or link to an existing one (e.g. restormel-keys-dashboard)."
echo ""
read -r -p "Have you already run 'vercel link' with Root Directory = apps/dashboard? [y/N] " ok
if [[ "$ok" != "y" && "$ok" != "Y" ]]; then
  echo "Run:  $VERCEL_CMD link"
  echo "Then re-run this script."
  exit 0
fi

echo ""
echo "Step 2: Add environment variables in Vercel."
echo "  In Vercel Dashboard → Project → Settings → Environment Variables, add (Production + Preview):"
echo "    DATABASE_URL        (Neon connection string for production branch)"
echo "    NEON_AUTH_BASE_URL  (Auth base URL from Neon Console → Branch → Auth → Configuration)"
echo "  Optional: PADDLE_SECRET, PADDLE_API_KEY, API_KEY_HASH"
echo ""
echo "  GitHub OAuth is configured in Neon Console (Auth → OAuth providers → GitHub)."
echo "  In your GitHub OAuth App, set Authorization callback URL to your dashboard callback, e.g.:"
echo "    https://your-project.vercel.app/keys/dashboard/api/auth/callback/github"
echo "    or https://restormel.dev/keys/dashboard/api/auth/callback/github if fronted by Cloudflare."
echo ""
echo "  Or via CLI (one-off, avoid for secrets in shared shells):"
echo "    echo -n \"YOUR_VALUE\" | vercel env add DATABASE_URL production"
echo "    echo -n \"YOUR_VALUE\" | vercel env add NEON_AUTH_BASE_URL production"
echo "    ... (repeat for each var)"
echo ""
read -r -p "Have you added the env vars in Vercel? [y/N] " ok2
if [[ "$ok2" != "y" && "$ok2" != "Y" ]]; then
  echo "Add them in Vercel Dashboard or via 'vercel env add', then deploy."
  exit 0
fi

echo ""
echo "Step 3: Deploy."
echo "  From repo root:  $VERCEL_CMD --prod   (or push to main if project is Git-connected)."
echo ""
echo "Step 4: Point the site Worker at Vercel."
echo "  Set KEYS_DASHBOARD_URL to your Vercel deployment URL (e.g. https://restormel-keys-dashboard.vercel.app)."
echo "  In Cloudflare: Workers & Pages → restormel-site → Settings → Variables → KEYS_DASHBOARD_URL."
echo "  Or in GitHub Actions secrets (if CI deploys the Worker): set KEYS_DASHBOARD_URL to the Vercel URL."
echo ""
echo "Step 5: GitHub OAuth App."
echo "  In Neon Console → Auth → OAuth providers → GitHub, enter your GitHub OAuth App Client ID and Secret."
echo "  In the GitHub OAuth App settings, set Authorization callback URL to your dashboard callback, e.g.:"
echo "    https://your-project.vercel.app/keys/dashboard/api/auth/callback/github"
echo "    or https://restormel.dev/keys/dashboard/api/auth/callback/github"
echo ""
echo "Done. After first deploy, open the Vercel URL and sign in with GitHub to verify."

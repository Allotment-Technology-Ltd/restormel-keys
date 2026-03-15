#!/usr/bin/env bash
# Grant the dashboard service account Secret Manager access to the Firebase Admin secret.
# Run once after the SA and secret exist (or when Cloud Run fails with "Permission denied on secret").
# Requires: gcloud auth application-default login and project restormel-keys-prod.
set -euo pipefail
PROJECT="${1:-restormel-keys-prod}"
SECRET_NAME="firebase-admin-credentials"
SA_EMAIL="keys-dashboard-sa@${PROJECT}.iam.gserviceaccount.com"
echo "Granting ${SA_EMAIL} access to secret ${SECRET_NAME} in project ${PROJECT}..."
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --project="$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
echo "Done."

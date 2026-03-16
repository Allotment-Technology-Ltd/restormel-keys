/**
 * Restormel Keys GCP infrastructure.
 * Service account, Artifact Registry, Cloud Run (dashboard). No load balancer — site is on Cloudflare Worker; dashboard is reached via direct Cloud Run URL or Worker proxy (Phase 3).
 * NO VPC, SurrealDB, or ingestion job (Prompt 1.4).
 */
import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const region = config.get("gcp:region") ?? "europe-west2";
// Use the same project as the GCP provider (from config "gcp:project"). Do not use pulumi.getProject() — that is the Pulumi project name, e.g. "restormel-keys", not the GCP project ID.
const gcpConfig = new pulumi.Config("gcp");
const project = gcpConfig.require("project");

// --- (a) Service account for dashboard ---
const dashboardSa = new gcp.serviceaccount.Account("keys-dashboard-sa", {
  accountId: "keys-dashboard-sa",
  displayName: "Restormel Keys Dashboard",
});

// --- (b) Artifact Registry repository ---
const registry = new gcp.artifactregistry.Repository("keys-registry", {
  location: region,
  repositoryId: "restormel-keys",
  description: "Container images for Restormel Keys",
  format: "DOCKER",
});

// --- (c) Cloud Run service (keys-dashboard) ---
// Placeholder image until first deploy; 512Mi/1 CPU, 0-3 instances.
const dashboardImage = config.get("dashboardImage") ?? "gcr.io/cloudrun/placeholder";
const dashboardSecrets: Record<string, pulumi.Input<string>> = {};
["PADDLE_SECRET", "PADDLE_API_KEY", "API_KEY_HASH", "DATABASE_URL", "NEON_AUTH_BASE_URL"].forEach((key) => {
  const secretRef = config.get(`${key}_SECRET_REF`);
  if (secretRef) {
    dashboardSecrets[key] = secretRef;
  }
});

const dashboardService = new gcp.cloudrun.Service("keys-dashboard", {
  name: "keys-dashboard",
  location: region,
  template: {
    metadata: {
      annotations: {
        "autoscaling.knative.dev/minScale": "0",
        "autoscaling.knative.dev/maxScale": "3",
      },
    },
    spec: {
      containerConcurrency: 80,
      timeoutSeconds: 300,
      serviceAccountName: dashboardSa.email,
      containers: [
        {
          image: dashboardImage,
          resources: {
            limits: {
              memory: "512Mi",
              cpu: "1",
            },
          },
          envs: [
            ...Object.entries(dashboardSecrets).map(([name, value]) => ({
              name,
              valueFrom: {
                secretKeyRef: {
                  name: value as string,
                  key: "latest",
                },
              },
            })),
          ],
        },
      ],
    },
  },
  traffics: [{ percent: 100, latestRevision: true }],
});

// --- (f) IAM: public invoker ---
const publicInvoker = new gcp.cloudrun.IamMember("keys-dashboard-public-invoker", {
  location: dashboardService.location,
  service: dashboardService.name,
  role: "roles/run.invoker",
  member: "allUsers",
});

// --- Exports ---
export const dashboardServiceUrl = dashboardService.statuses.apply(
  (s) => (s && s[0] ? s[0].url : "")
);
export const dashboardServiceName = dashboardService.name;
export const dashboardServiceAccountEmail = dashboardSa.email;
export const artifactRegistryRepository = registry.name;

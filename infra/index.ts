/**
 * Restormel Keys GCP infrastructure.
 * Subset: service account, Artifact Registry, Cloud Run (dashboard), load balancer (global IP, serverless NEG, backend, SSL, URL map, HTTPS proxy, forwarding rule).
 * NO VPC, SurrealDB, or ingestion job (Prompt 1.4).
 */
import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const region = config.get("gcp:region") ?? "europe-west2";
const project = config.get("gcp:project") ?? pulumi.getProject();
/** Apex domain (e.g. restormel.dev). When set, www.<domain> is also supported; www redirects to apex. */
const domain = config.get("domain") ?? "";
const wwwDomain = domain ? `www.${domain}` : "";

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
["PADDLE_SECRET", "FIREBASE_CONFIG", "API_KEY_HASH"].forEach((key) => {
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
          envs: Object.entries(dashboardSecrets).map(([name, value]) => ({
            name,
            valueFrom: {
              secretKeyRef: {
                name: value as string,
                key: "latest",
              },
            },
          })),
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

// --- (e) Load balancer: global static IP, serverless NEG, backend service, SSL cert, URL map, HTTPS proxy, forwarding rule ---
const staticIp = new gcp.compute.GlobalAddress("keys-dashboard-lb-ip", {
  name: "keys-dashboard-lb-ip",
});

const serverlessNeg = new gcp.compute.RegionNetworkEndpointGroup("keys-dashboard-neg", {
  name: "keys-dashboard-neg",
  networkEndpointType: "SERVERLESS",
  region,
  cloudRun: {
    service: dashboardService.name,
  },
});

const backendService = new gcp.compute.BackendService("keys-dashboard-backend", {
  name: "keys-dashboard-backend",
  protocol: "HTTP",
  loadBalancingScheme: "EXTERNAL_MANAGED",
  backends: [
    {
      group: serverlessNeg.id,
    },
  ],
});

// SSL: create managed cert only when domain is set (required for HTTPS proxy).
// Cert covers both apex (restormel.dev) and www (www.restormel.dev).
const managedCert =
  domain !== ""
    ? new gcp.compute.ManagedSslCertificate("keys-dashboard-cert", {
        name: "keys-dashboard-cert",
        managed: {
          domains: wwwDomain ? [domain, wwwDomain] : [domain],
        },
      })
    : null;

// Host rule: www.<domain> → redirect to apex; everything else → backend.
const urlMap = new gcp.compute.URLMap("keys-dashboard-urlmap", {
  name: "keys-dashboard-urlmap",
  defaultService: backendService.id,
  hostRules:
    wwwDomain !== ""
      ? [{ hosts: [wwwDomain], pathMatcher: "redirect-www" }]
      : [],
  pathMatchers:
    wwwDomain !== ""
      ? [
          {
            name: "redirect-www",
            defaultUrlRedirect: {
              hostRedirect: domain,
              httpsRedirect: true,
              redirectResponseCode: "MOVED_PERMANENTLY_DEFAULT",
              stripQuery: true,
            },
          },
        ]
      : [],
});

// HTTPS proxy and forwarding rule require at least one SSL cert; create only when domain is set.
const httpsProxy =
  managedCert != null
    ? new gcp.compute.TargetHttpsProxy("keys-dashboard-https-proxy", {
        name: "keys-dashboard-https-proxy",
        urlMap: urlMap.id,
        sslCertificates: [managedCert.id],
      })
    : null;

const forwardingRule =
  httpsProxy != null
    ? new gcp.compute.GlobalForwardingRule("keys-dashboard-https-rule", {
        name: "keys-dashboard-https-rule",
        target: httpsProxy.id,
        ipAddress: staticIp.address,
        portRange: "443",
        loadBalancingScheme: "EXTERNAL_MANAGED",
      })
    : null;

// HTTP (port 80) → HTTPS redirect when domain is set (same global IP).
const httpRedirectUrlMap =
  domain !== ""
    ? new gcp.compute.URLMap("keys-dashboard-http-redirect-urlmap", {
        name: "keys-dashboard-http-redirect-urlmap",
        defaultUrlRedirect: {
          httpsRedirect: true,
          redirectResponseCode: "MOVED_PERMANENTLY_DEFAULT",
          stripQuery: true,
        },
      })
    : null;

const httpProxy =
  httpRedirectUrlMap != null
    ? new gcp.compute.TargetHttpProxy("keys-dashboard-http-proxy", {
        name: "keys-dashboard-http-proxy",
        urlMap: httpRedirectUrlMap.id,
      })
    : null;

const httpForwardingRule =
  httpProxy != null
    ? new gcp.compute.GlobalForwardingRule("keys-dashboard-http-rule", {
        name: "keys-dashboard-http-rule",
        target: httpProxy.id,
        ipAddress: staticIp.address,
        portRange: "80",
        loadBalancingScheme: "EXTERNAL_MANAGED",
      })
    : null;

// --- Exports ---
export const dashboardServiceUrl = dashboardService.statuses.apply(
  (s) => (s && s[0] ? s[0].url : "")
);
export const dashboardServiceName = dashboardService.name;
export const dashboardServiceAccountEmail = dashboardSa.email;
export const artifactRegistryRepository = registry.name;
export const loadBalancerIp = staticIp.address;
export const loadBalancerHttpsRule = forwardingRule
  ? forwardingRule.name
  : pulumi.output("");

/** Google-managed SSL certificate name. Check status with: gcloud compute ssl-certificates describe <name> --global */
export const managedCertificateName = managedCert
  ? managedCert.name
  : pulumi.output("");

/** DNS records to create in Vercel (or any DNS). Apex and www both point to load balancer IP. */
export const dnsRecordsForVercel = pulumi
  .all([domain, loadBalancerIp])
  .apply(([d, ip]) =>
    d && ip
      ? {
          apex: { type: "A" as const, name: "@", value: ip, ttl: 3600 },
          www: { type: "A" as const, name: "www", value: ip, ttl: 3600 },
        }
      : null
  );

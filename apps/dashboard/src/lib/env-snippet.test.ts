import { describe, expect, it } from "vitest";
import {
  ciStagingSecretsSnippet,
  gatewayKeyEnvSnippet,
  restormelControlPlaneBaseUrl,
  restormelEvaluatePolicyUrl,
} from "./env-snippet";

describe("restormelEvaluatePolicyUrl", () => {
  it("appends dashboard evaluate path", () => {
    expect(restormelEvaluatePolicyUrl("https://restormel.dev")).toBe(
      "https://restormel.dev/keys/dashboard/api/policies/evaluate",
    );
  });
});

describe("restormelControlPlaneBaseUrl", () => {
  it("appends keys dashboard base without trailing slash", () => {
    expect(restormelControlPlaneBaseUrl("https://restormel.dev/")).toBe("https://restormel.dev/keys/dashboard");
  });
});

describe("gatewayKeyEnvSnippet", () => {
  it("includes keys base, control plane, evaluate, gateway, and server token", () => {
    const s = gatewayKeyEnvSnippet("gk_test", "proj-1", "https://keys.example/");
    expect(s).toContain("RESTORMEL_GATEWAY_KEY=gk_test");
    expect(s).toContain("RESTORMEL_SERVER_TOKEN=gk_test");
    expect(s).toContain("RESTORMEL_KEYS_BASE=https://keys.example");
    expect(s).toContain("RESTORMEL_CONTROL_PLANE_URL=https://keys.example/keys/dashboard");
    expect(s).toContain("RESTORMEL_EVALUATE_URL=https://keys.example/keys/dashboard/api/policies/evaluate");
  });
});

describe("ciStagingSecretsSnippet", () => {
  it("includes gateway, project, env, and base when provided", () => {
    const s = ciStagingSecretsSnippet({
      gatewayKey: "secret-key",
      projectId: "p1",
      environmentId: "e1",
      environmentLabel: "Development",
      keysBaseUrl: "https://app.example",
    });
    expect(s).toContain("RESTORMEL_GATEWAY_KEY_STAGING=secret-key");
    expect(s).toContain("RESTORMEL_PROJECT_ID_STAGING=p1");
    expect(s).toContain("RESTORMEL_ENVIRONMENT_ID_STAGING=e1");
    expect(s).toContain("Environment: Development");
    expect(s).toContain("RESTORMEL_KEYS_BASE_STAGING=https://app.example");
    expect(s).toContain(
      "RESTORMEL_EVALUATE_URL_STAGING=https://app.example/keys/dashboard/api/policies/evaluate",
    );
    expect(s).toContain("RESTORMEL_CONTROL_PLANE_URL_STAGING=https://app.example/keys/dashboard");
    expect(s).toContain("RESTORMEL_SERVER_TOKEN_STAGING=secret-key");
    expect(s).toContain("RESTORMEL_PROJECT_ID=p1");
    expect(s).toContain("RESTORMEL_ENVIRONMENT_ID=e1");
  });

  it("uses placeholder lines when gateway and env missing", () => {
    const s = ciStagingSecretsSnippet({
      projectId: "p1",
      keysBaseUrl: "https://x",
    });
    expect(s).toContain("RESTORMEL_GATEWAY_KEY_STAGING=");
    expect(s).toContain("RESTORMEL_PROJECT_ID_STAGING=p1");
    expect(s).toContain("RESTORMEL_ENVIRONMENT_ID_STAGING=");
    expect(s).toContain("No environments");
  });

  it("omits environment id lines when includeEnvironmentId is false", () => {
    const s = ciStagingSecretsSnippet({
      projectId: "p1",
      environmentId: "e1",
      keysBaseUrl: "https://x",
      includeEnvironmentId: false,
    });
    expect(s).not.toContain("RESTORMEL_ENVIRONMENT_ID");
    expect(s).toContain("RESTORMEL_PROJECT_ID=p1");
  });

  // ux-projects-crud (spec §3/§8-B3): the environments-flag-OFF CI snippet keeps project id,
  // gateway key + server token, keys base, evaluate + control-plane URLs, and drops every
  // RESTORMEL_ENVIRONMENT_ID line. This is what the projects/[id] page copies when the flag is off.
  it("flag-OFF snippet carries project id + gateway key + URLs and NO environment id", () => {
    const s = ciStagingSecretsSnippet({
      gatewayKey: "gk_flagoff",
      projectId: "proj-42",
      environmentId: "env-should-be-dropped",
      environmentLabel: "Production",
      keysBaseUrl: "https://keys.example",
      includeEnvironmentId: false,
    });
    expect(s).toContain("RESTORMEL_GATEWAY_KEY_STAGING=gk_flagoff");
    expect(s).toContain("RESTORMEL_SERVER_TOKEN_STAGING=gk_flagoff");
    expect(s).toContain("RESTORMEL_PROJECT_ID_STAGING=proj-42");
    expect(s).toContain("RESTORMEL_KEYS_BASE_STAGING=https://keys.example");
    expect(s).toContain(
      "RESTORMEL_EVALUATE_URL_STAGING=https://keys.example/keys/dashboard/api/policies/evaluate",
    );
    expect(s).toContain("RESTORMEL_CONTROL_PLANE_URL_STAGING=https://keys.example/keys/dashboard");
    expect(s).toContain("RESTORMEL_PROJECT_ID=proj-42");
    // The env id and its comment/label must be fully absent — not just blank.
    expect(s).not.toContain("RESTORMEL_ENVIRONMENT_ID");
    expect(s).not.toContain("env-should-be-dropped");
    expect(s).not.toContain("Environment: Production");
  });
});

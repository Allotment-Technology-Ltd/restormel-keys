/**
 * JSON Schema mirrors for MCP tool docs (`tools.ts`).
 * **Runtime Zod** for the same shapes lives in `register-tools.ts` — keep aligned when fields change.
 */
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] } as const;
const nullableBoolean = { anyOf: [{ type: "boolean" }, { type: "null" }] } as const;

const jsonObject = { type: "object", additionalProperties: true } as const;

const routeMetaProperties = {
  id: { type: "string" },
  environmentId: { type: "string" },
  workload: nullableString,
  stage: nullableString,
  enabled: nullableBoolean,
  version: nullableNumber,
  publishedVersion: nullableNumber,
} as const;

const routeMetaSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "environmentId",
    "workload",
    "stage",
    "enabled",
    "version",
    "publishedVersion",
  ],
  properties: routeMetaProperties,
} as const;

const routingAttemptItem = {
  type: "object",
  additionalProperties: false,
  required: ["stepId", "orderIndex", "hypotheticalOutcome"],
  properties: {
    stepId: { type: "string" },
    orderIndex: { type: "number" },
    providerType: nullableString,
    modelId: nullableString,
    hypotheticalOutcome: {
      type: "string",
      enum: ["selected", "blocked_by_policy", "not_executable", "not_selected"],
    },
  },
} as const;

const perStepEstimateItem = {
  type: "object",
  additionalProperties: false,
  required: [
    "stepId",
    "orderIndex",
    "providerType",
    "modelId",
    "estimatedCostUsd",
    "wouldRun",
    "wouldBeSkippedBecause",
  ],
  properties: {
    stepId: { type: "string" },
    orderIndex: { type: "number" },
    providerType: nullableString,
    modelId: nullableString,
    estimatedCostUsd: nullableNumber,
    wouldRun: { type: "boolean" },
    wouldBeSkippedBecause: nullableString,
  },
} as const;

const stepDiagnosticItem = {
  type: "object",
  additionalProperties: false,
  required: ["stepId", "orderIndex", "providerType", "modelId", "policyViolations", "executable"],
  properties: {
    stepId: { type: "string" },
    orderIndex: { type: "number" },
    providerType: nullableString,
    modelId: nullableString,
    policyViolations: { type: "array", items: jsonObject },
    executable: { type: "boolean" },
  },
} as const;

const decisionMetadataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "selectedStepId",
    "selectedOrderIndex",
    "switchReasonCode",
    "providerType",
    "modelId",
    "estimatedCostUsd",
    "matchedCriteria",
    "fallbackCandidates",
    "stepChain",
    "route",
  ],
  properties: {
    selectedStepId: nullableString,
    selectedOrderIndex: nullableNumber,
    switchReasonCode: nullableString,
    providerType: nullableString,
    modelId: nullableString,
    estimatedCostUsd: nullableNumber,
    matchedCriteria: { anyOf: [{ type: "null" }, jsonObject] },
    fallbackCandidates: { type: "array", items: jsonObject },
    stepChain: { type: "array", items: jsonObject },
    route: routeMetaSchema,
  },
} as const;

const simulateSuccessData = {
  type: "object",
  description:
    "Dashboard POST …/simulate success `data`. `additionalProperties` allows forward-compatible fields; keep Zod in register-tools.ts aligned when adding new first-class keys.",
  additionalProperties: true,
  required: [
    "contractVersion",
    "traceId",
    "routeId",
    "routeName",
    "route",
    "providerType",
    "modelId",
    "explanation",
    "selectedStepId",
    "selectedOrderIndex",
    "switchReasonCode",
    "estimatedCostUsd",
    "matchedCriteria",
    "fallbackCandidates",
    "stepChain",
    "decisionMetadata",
    "perStepEstimates",
    "wouldRun",
    "switchOutcomePreview",
  ],
  properties: {
    contractVersion: { type: "string" },
    traceId: nullableString,
    routeId: { type: "string" },
    routeName: { type: "string" },
    route: routeMetaSchema,
    providerType: nullableString,
    modelId: nullableString,
    explanation: { type: "string" },
    selectedStepId: nullableString,
    selectedOrderIndex: nullableNumber,
    switchReasonCode: nullableString,
    estimatedCostUsd: nullableNumber,
    matchedCriteria: { anyOf: [{ type: "null" }, jsonObject] },
    fallbackCandidates: { type: "array", items: jsonObject },
    stepChain: { type: "array", items: jsonObject },
    decisionMetadata: decisionMetadataSchema,
    perStepEstimates: { type: "array", items: perStepEstimateItem },
    stepDiagnostics: { type: "array", items: stepDiagnosticItem },
    routingAttempts: { type: "array", items: routingAttemptItem },
    wouldRun: { type: "boolean" },
    switchOutcomePreview: {
      type: "object",
      additionalProperties: false,
      required: ["attemptNumber", "failureKind", "selectedOrderIndex"],
      properties: {
        attemptNumber: { type: "number" },
        failureKind: nullableString,
        selectedOrderIndex: nullableNumber,
      },
    },
  },
} as const;

/** MCP `routes.simulate` structuredContent envelope (success path matches dashboard simulate). */
export const routesSimulateMcpOutputSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["status", "serverOnlyToken"],
  properties: {
    data: simulateSuccessData,
    error: { type: "string" },
    status: { type: "string" },
    serverOnlyToken: { type: "boolean" },
  },
};

const routeGraphBundleBody = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "exportedAt", "projectId", "route", "steps"],
  properties: {
    schemaVersion: { type: "string", enum: ["1.0.0"] },
    exportedAt: { type: "number" },
    projectId: { type: "string" },
    route: jsonObject,
    steps: { type: "array", items: jsonObject },
  },
} as const;

/** MCP `routing.export` structuredContent envelope. */
export const routingExportMcpOutputSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["status", "serverOnlyToken"],
  properties: {
    data: routeGraphBundleBody,
    error: { type: "string" },
    status: { type: "string" },
    serverOnlyToken: { type: "boolean" },
  },
};

const routingImportDataBody = {
  type: "object",
  additionalProperties: false,
  required: ["route", "steps"],
  properties: {
    route: jsonObject,
    steps: { type: "array", items: jsonObject },
  },
} as const;

/** MCP `routing.import` structuredContent envelope (POST import success = route + steps rows). */
export const routingImportMcpOutputSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["status", "serverOnlyToken"],
  properties: {
    data: routingImportDataBody,
    error: { type: "string" },
    status: { type: "string" },
    serverOnlyToken: { type: "boolean" },
  },
};

const explainChainScopeEnum = {
  type: "string",
  enum: ["workspace", "project", "environment", "route"],
} as const;

const explainChainPolicyItem = {
  type: "object",
  additionalProperties: false,
  required: ["scope", "bindingId", "policyId", "name", "type", "status", "ruleSummary"],
  properties: {
    scope: explainChainScopeEnum,
    bindingId: { type: "string" },
    policyId: { type: "string" },
    name: { type: "string" },
    type: { type: "string" },
    status: { type: "string" },
    ruleSummary: { type: "string" },
    ruleDefinition: jsonObject,
  },
} as const;

const explainChainOrderedStepItem = {
  type: "object",
  additionalProperties: false,
  required: [
    "stepId",
    "orderIndex",
    "providerPreference",
    "modelId",
    "enabled",
    "label",
    "hasConditionBlock",
  ],
  properties: {
    stepId: { type: "string" },
    orderIndex: { type: "number" },
    providerPreference: nullableString,
    modelId: nullableString,
    enabled: { type: "boolean" },
    label: nullableString,
    hasConditionBlock: { type: "boolean" },
    advanceOn: { type: "array", items: { type: "string" } },
    retryOn: { type: "array", items: { type: "string" } },
  },
} as const;

const explainChainRouteBlock = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "environmentId",
    "workload",
    "stage",
    "routeMode",
    "enabled",
    "status",
    "isPublished",
    "version",
    "publishedVersion",
    "defaultModelId",
    "billingMode",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    environmentId: { type: "string" },
    workload: nullableString,
    stage: nullableString,
    routeMode: nullableString,
    enabled: { type: "boolean" },
    status: { type: "string" },
    isPublished: { type: "boolean" },
    version: nullableNumber,
    publishedVersion: nullableNumber,
    defaultModelId: nullableString,
    billingMode: nullableString,
  },
} as const;

const catalogCrowdHintItem = {
  type: "object",
  additionalProperties: false,
  required: [
    "stepId",
    "catalogProviderId",
    "providerModelId",
    "deprecatedReportCount",
    "retiredReportCount",
  ],
  properties: {
    stepId: nullableString,
    catalogProviderId: { type: "string" },
    providerModelId: { type: "string" },
    deprecatedReportCount: { type: "number" },
    retiredReportCount: { type: "number" },
  },
} as const;

const routingExplainChainDataBody = {
  type: "object",
  description:
    "Dashboard GET …/explain-chain success `data`. Root allows forward-compatible properties; keep Zod in register-tools.ts aligned.",
  additionalProperties: true,
  required: [
    "contractVersion",
    "projectId",
    "routeId",
    "environmentId",
    "route",
    "steps",
    "policies",
    "narrative",
  ],
  properties: {
    contractVersion: { type: "string" },
    projectId: { type: "string" },
    routeId: { type: "string" },
    environmentId: { type: "string" },
    route: explainChainRouteBlock,
    steps: {
      type: "object",
      additionalProperties: false,
      required: ["total", "enabledCount", "ordered"],
      properties: {
        total: { type: "number" },
        enabledCount: { type: "number" },
        ordered: { type: "array", items: explainChainOrderedStepItem },
      },
    },
    policies: { type: "array", items: explainChainPolicyItem },
    catalogCrowdHints: { type: "array", items: catalogCrowdHintItem },
    narrative: { type: "array", items: { type: "string" } },
  },
} as const;

/** MCP `routing.explain_chain` structuredContent envelope. */
export const routingExplainChainMcpOutputSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["status", "serverOnlyToken"],
  properties: {
    data: routingExplainChainDataBody,
    error: { type: "string" },
    status: { type: "string" },
    serverOnlyToken: { type: "boolean" },
  },
};

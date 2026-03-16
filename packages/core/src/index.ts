export { createKeys } from "./keys.js";
export type { CreateKeysOptions, KeysInstance } from "./keys.js";
export type {
  CostEstimate,
  EntitlementConfig,
  EntitlementResult,
  KeyConfig,
  KeysConfig,
  ModelDefinition,
  PlanDefinition,
  ProviderId,
  ResolvedRoute,
  RoutingConfig,
  UsageRecord,
  UsageSummary,
  ValidationResult,
} from "./types.js";

export {
  openaiProvider,
  OPENAI_MODELS,
  anthropicProvider,
  ANTHROPIC_MODELS,
  googleProvider,
  GOOGLE_MODELS,
} from "./providers/index.js";
export type {
  ProviderDefinition,
  ProviderValidationResult,
  ProviderCostEstimate,
  ProviderClient,
} from "./providers/index.js";

export { createRouter, NO_KEY_AVAILABLE } from "./router.js";
export type { Router, ResolveResult, RouterOptions } from "./router.js";
export { estimateCost, trackCost } from "./cost.js";
export type { CostEstimateResult, UsageTracker } from "./cost.js";
export { createEntitlements } from "./entitlements.js";
export type { Entitlements } from "./entitlements.js";
export { createWallet } from "./wallet.js";
export type { Wallet, WalletStore } from "./wallet.js";

export type {
  Workspace,
  Project,
  Environment,
  GatewayKey,
  ManagementKey,
  ProviderIntegration,
  ProviderBinding,
  Model,
  ProviderModelVariant,
  LifecycleState,
  Route,
  RouteStep,
  Policy,
  PolicyType,
  PolicyBinding,
  PolicyTargetType,
  RequestLog,
  UsageAggregate,
  AuditEvent,
  CustomerTenant,
  ExposureRule,
  PricingRecord,
  RateLimitRecord,
  LifecycleEvent,
  LifecycleEventType,
} from "./domain.js";

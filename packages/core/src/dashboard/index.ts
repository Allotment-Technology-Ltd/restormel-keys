/**
 * Restormel dashboard API client: typed resolve and evaluate.
 * Use from server-side only; never send Gateway Key to the browser.
 * @see docs/reference/policy-enforcement.md
 */
export type {
  ResolveOptions,
  RouteResolveMetadata,
  ResolveStepChainEntry,
  ResolveSuccess,
  ResolveError,
  ResolveResult,
  ValidateRouteBindingOptions,
  ValidateRouteBindingSuccess,
  ValidateRouteBindingFailure,
  ValidateRouteBindingResult,
  EvaluateOptions,
  EvaluateResult,
  PolicyViolation,
  RestormelApiError,
  ResolveErrorBody,
  CatalogProviderValidation,
  CatalogProvider,
  CatalogVariant,
  CatalogModel,
  CanonicalCatalogResponse,
  FetchCanonicalCatalogOptions,
  FilterCanonicalCatalogOptions,
  ReportCatalogModelObservationOptions,
} from "./types.js";

export type {
  AllowedModelsCandidate,
  FilterAllowedModelsOptions,
  FilteredModelEntry,
  FilteredModelStatus,
  PolicyAvailabilityMapEntry,
  GroupedModelForSelector,
  GroupedProviderForSelector,
} from "./client.js";

export {
  resolve,
  validateRouteBinding,
  evaluatePolicies,
  filterAllowedModels,
  filterModelsByPolicy,
  candidatesFromProviderDefinitions,
  groupedModelsForModelSelector,
  policyAvailabilityMapFromEntries,
  filterProviderDefinitionsByAllowedPolicy,
  fetchCanonicalCatalog,
  fetchCanonicalCatalogWithFallback,
  reportCatalogModelObservation,
  filterCanonicalCatalogForViability,
  isPolicyBlocked,
  isNoRoute,
  isUsageLimitReached,
  isRouteUnpublished,
  isRouteDisabled,
  isNoKeyAvailable,
  isResolveIncomplete,
  isUnauthorizedResolve,
  isPolicyBlockedError,
} from "./client.js";

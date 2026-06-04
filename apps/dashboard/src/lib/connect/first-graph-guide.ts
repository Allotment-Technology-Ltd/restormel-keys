/** Shared copy for first-graph onboarding (client + server safe). */
export const STARTER_CORPUS_NAME_PREFIX = "Starter:";

export const SUGGESTED_GRAPH_DESIGNER_INTENT =
  "Extract philosophical claims and argument structure from short ethics and epistemology passages—" +
  "premises, conclusions, objections, and discourse relations like supports, contradicts, and responds_to.";

export const FIRST_GRAPH_ONBOARDING_DOC_HREF = "/keys/docs/guides/connect-first-graph-onboarding";

export type FirstGraphGuideState = {
  surrealStoreReady: boolean;
  modelsReady: boolean;
  hasChatRoute: boolean;
  hasEmbeddingRoute: boolean;
  starterCorpusLoaded: boolean;
  customPackSaved: boolean;
  hasIngestJob: boolean;
  hasGraph: boolean;
  integrationsCount: number;
};

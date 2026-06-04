/**
 * Host-injected LLM and routing — no SOPHIA vertex or Keys imports in this package.
 */
export type ModelRoute = {
  /** Opaque model handle (e.g. Vercel AI SDK LanguageModel). */
  model: unknown;
  modelId: string;
  provider: string;
  resolvedRouteId?: string | null;
  resolvedExplanation?: string | null;
};

export type GenerateTextParams = {
  model: unknown;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
};

export type GenerateTextResult = {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type RouteOptions = {
  providerApiKeys?: unknown;
  depthMode?: string;
  failureMode?: "error" | "fallback";
};

export type ReasoningCoreContext = {
  generateText: (params: GenerateTextParams) => Promise<GenerateTextResult>;
  resolveExtractionRoute: (options?: RouteOptions) => Promise<ModelRoute>;
  resolveReasoningRoute: (options?: RouteOptions) => Promise<ModelRoute>;
  trackTokens?: (input: number, output: number) => void;
};

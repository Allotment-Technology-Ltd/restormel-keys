/**
 * Single import for "click-and-select" UIs: all first-party providers in one array.
 * Use this when you want to offer every built-in provider and model without
 * manually listing each one.
 */
import type { ProviderDefinition } from "./types.js";
import { openaiProvider } from "./openai.js";
import { anthropicProvider } from "./anthropic.js";
import { googleProvider } from "./google.js";
import { xaiProvider } from "./xai.js";
import { voyageProvider } from "./voyage.js";
import { mistralProvider } from "./mistral.js";
import { groqProvider } from "./groq.js";
import { togetherProvider } from "./together.js";
import { deepseekProvider } from "./deepseek.js";
import { fireworksProvider } from "./fireworks.js";
import { cohereProvider } from "./cohere.js";
import { perplexityProvider } from "./perplexity.js";
import { azureOpenaiProvider } from "./azure-openai.js";
import { openrouterProvider } from "./openrouter.js";
import { portkeyProvider } from "./portkey.js";

/** All first-party providers in display order. Use for KeyManager, ModelSelector, and catalog UIs. */
export const defaultProviders: ProviderDefinition[] = [
  openaiProvider,
  anthropicProvider,
  googleProvider,
  xaiProvider,
  mistralProvider,
  groqProvider,
  deepseekProvider,
  cohereProvider,
  perplexityProvider,
  togetherProvider,
  fireworksProvider,
  voyageProvider,
  azureOpenaiProvider,
  openrouterProvider,
  portkeyProvider,
];

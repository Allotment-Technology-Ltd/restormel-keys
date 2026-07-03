/**
 * Type declarations for custom elements so refs and JSX work.
 */
import type * as React from "react";
import type { KeysInstance } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import type { CostEstimateResult } from "@restormel/keys";
import type { ProviderValidationResult } from "@restormel/keys";

export interface RkKeyManagerElement extends HTMLElement {
  keys: KeysInstance | null;
  userId: string;
  providers: ProviderDefinition[];
  onValidate?: (provider: string, rawCredential: string) => Promise<ProviderValidationResult>;
  onRevalidate?: (keyId: string, provider: string) => Promise<ProviderValidationResult>;
}

export interface RkModelSelectorElement extends HTMLElement {
  keys: KeysInstance | null;
  providers: ProviderDefinition[];
}

export interface RkCostEstimatorElement extends HTMLElement {
  cost: CostEstimateResult | null;
  budget?: number;
  estimatedCost?: number;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "rk-key-manager": React.DetailedHTMLProps<
        React.HTMLAttributes<RkKeyManagerElement> & { "user-id"?: string },
        RkKeyManagerElement
      >;
      "rk-model-selector": React.DetailedHTMLProps<
        React.HTMLAttributes<RkModelSelectorElement>,
        RkModelSelectorElement
      >;
      "rk-cost-estimator": React.DetailedHTMLProps<
        React.HTMLAttributes<RkCostEstimatorElement> & {
          budget?: number;
          "estimated-cost"?: number;
        },
        RkCostEstimatorElement
      >;
    }
  }
}

export {};

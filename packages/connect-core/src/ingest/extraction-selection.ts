/**
 * Extraction connector selection — the single composition root (plugpoints rule:
 * "selection is evaluated ONCE at the composition root; one edit kills the whole
 * surface"). Adapters are chosen by a `providerId:modelId` config key. There are NO
 * `if (provider === "x")` branches in the verification spine — a swap is one config
 * edit, which is what makes the swap test's zero-spine-diff criterion hold.
 *
 * The registry maps a config key to a factory. Network/credentialed adapters take a
 * host-provided transport, so this module (and connect-core) stays credential-free:
 * the host wires the real PaddleOCR-VL endpoint / Mistral API key into the transport
 * and passes it here. The textual fallback needs no transport.
 *
 * Fail-closed (plugpoints removability check 6 + REC-ADR-023 invariant 3): a config
 * key with no registered adapter throws a named error rather than silently degrading
 * — a missing/disabled component is never a silent pass.
 */
import { ExtractionError, type ExtractionConnector } from "./extraction-connector.js";
import { textualFallbackExtractionConnector } from "./extraction-connectors/textual-fallback.js";
import {
  createPaddleOcrVlConnector,
  type PaddleOcrVlTransport,
} from "./extraction-connectors/paddleocr-vl.js";
import {
  createMistralOcrConnector,
  type MistralOcrTransport,
} from "./extraction-connectors/mistral-ocr.js";

/** Canonical config keys (`providerId:modelId`). The DEFAULT is the managed default. */
export const EXTRACTION_CONNECTOR_KEYS = {
  /** Managed default (REC-GOV-022 CLEARED; D-2026-07-02-1 recommended set). */
  default: "paddleocr:paddleocr-vl-1.5",
  /** Curated alternative (REC-GOV-022 CLEARED API; pure-extraction only). */
  mistralOcr: "mistral:ocr-4",
  /** Tier-B degradation floor (no vendor, no licence gate). */
  textualFallback: "builtin:textual-fallback",
} as const;

export type ExtractionConnectorKey =
  (typeof EXTRACTION_CONNECTOR_KEYS)[keyof typeof EXTRACTION_CONNECTOR_KEYS];

/** Host-provided transports for the network adapters (credentials live in the host). */
export interface ExtractionTransports {
  paddleOcrVl?: PaddleOcrVlTransport;
  mistralOcr?: MistralOcrTransport;
}

/**
 * Resolve a config key to a connector. This is the ONE place selection happens.
 * The transports object supplies host-owned network implementations; the fallback
 * needs none. An unknown key or a network adapter without its transport fails closed.
 */
export function selectExtractionConnector(
  key: string,
  transports: ExtractionTransports = {},
): ExtractionConnector {
  switch (key) {
    case EXTRACTION_CONNECTOR_KEYS.default: {
      if (!transports.paddleOcrVl) {
        throw new ExtractionError(
          "credential_missing",
          "paddleocr-vl",
          "PaddleOCR-VL selected but no transport supplied by the host (fail closed).",
        );
      }
      return createPaddleOcrVlConnector(transports.paddleOcrVl);
    }
    case EXTRACTION_CONNECTOR_KEYS.mistralOcr: {
      if (!transports.mistralOcr) {
        throw new ExtractionError(
          "credential_missing",
          "mistral-ocr",
          "Mistral OCR selected but no transport supplied by the host (fail closed).",
        );
      }
      return createMistralOcrConnector(transports.mistralOcr);
    }
    case EXTRACTION_CONNECTOR_KEYS.textualFallback:
      return textualFallbackExtractionConnector;
    default:
      throw new ExtractionError(
        "unsupported_mime",
        key,
        `No extraction connector registered for key "${key}" (fail closed).`,
      );
  }
}

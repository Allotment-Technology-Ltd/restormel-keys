/**
 * G4 golden retrieval corpus (REC-ADR-008, Stage-1).
 *
 * A small, fixed, fingerprinted philosophy corpus used to compare strict-mode retrieval on
 * the host-managed Postgres spine against the canonical Surreal admission semantics. Each
 * unit carries the verification verdict EBV actually writes (`ok` → validated, `weak`,
 * `unsupported` → flagged) plus a verbatim text and a seed term, so a single strict query
 * exercises the trust-state filter across every category. The corpus is intentionally tiny
 * and deterministic so the gate is hermetic (no DB, no network) and reproducible in CI.
 *
 * Changing these units changes the fingerprint, which marks any baseline comparison as
 * "corpus changed" rather than a regression (mirrors the connect-eval fingerprint contract).
 */

/** @typedef {{ id: string, text: string, validation_status: "ok"|"weak"|"unsupported"|null, domain: string }} GoldenUnit */

/** @type {GoldenUnit[]} */
export const G4_GOLDEN_CORPUS = [
  { id: "u-mill-harm", text: "Mill argues the only purpose for which power can be rightfully exercised over a member of a civilised community against their will is to prevent harm to others.", validation_status: "ok", domain: "ethics" },
  { id: "u-bentham-calc", text: "Bentham holds the rightness of an action is determined solely by its consequences for aggregate happiness.", validation_status: "ok", domain: "ethics" },
  { id: "u-trolley-lever", text: "Diverting the trolley by pulling the lever to kill one instead of five is widely judged permissible.", validation_status: "ok", domain: "ethics" },
  { id: "u-bridge-push", text: "Pushing one large person off the footbridge to stop the trolley is judged differently from pulling the lever.", validation_status: "weak", domain: "ethics" },
  { id: "u-doctrine-overstated", text: "The doctrine of double effect proves that intention is the only morally relevant factor in any action whatsoever.", validation_status: "unsupported", domain: "ethics" },
  { id: "u-kant-formula", text: "Kant's formula of humanity holds that one must treat humanity never merely as a means but always also as an end.", validation_status: "ok", domain: "ethics" },
  { id: "u-hume-isought", text: "Hume observes that authors slide from is-statements to ought-statements without justifying the transition.", validation_status: "ok", domain: "epistemology" },
  { id: "u-fabricated", text: "Mill later renounced the harm principle and endorsed unlimited paternalism in his final works.", validation_status: "unsupported", domain: "ethics" },
];

/** Golden retrieval queries (each lexically matches a subset of the corpus). */
export const G4_GOLDEN_QUERIES = [
  "When is harm to others a ground for exercising power?",
  "Is pulling the lever on the trolley permissible?",
  "How does Kant say we must treat humanity?",
  "What does Hume observe about is and ought?",
];

/** Stable FNV-1a fingerprint over the corpus (id|status|text) — change ⇒ baseline superseded. */
export function g4CorpusFingerprint(units = G4_GOLDEN_CORPUS) {
  const lines = units
    .map((u) => `${u.id}|${u.validation_status ?? "null"}|${u.text}`)
    .sort()
    .join("\n");
  let h = 2166136261;
  for (let i = 0; i < lines.length; i++) {
    h ^= lines.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(16, "0").slice(0, 16);
}

/**
 * Batch coverage retry (H1, docs/reviews/connect-ingest-context.md §6).
 *
 * Verdict-batch stages (validation, remediation, entailment) ask a model to echo one
 * result per input ref. Loose-JSON parsing is fail-safe but used to be SILENT: a
 * truncated/garbled response lost the whole batch and the orchestrator only found out
 * via fail-safe defaults (weak/drop/abstain). This helper makes the loss observable —
 * it reports the shortfall (omitted ref count + whether the response was unparseable)
 * and re-asks the omitted refs EXACTLY ONCE before fail-safe coverage defaults apply.
 */

/** A parsed model response plus the parse-failure signal (H1). */
export type ParsedBatchResponse<R> = {
  results: R[];
  /** True when the raw response could not be parsed as JSON at all (batch lost). */
  parseFailed: boolean;
};

/** First-ask shortfall details, surfaced to the orchestrator before the retry. */
export type BatchCoverageShortfall = {
  /** Refs the model omitted on the first ask (everything, when parseFailed). */
  omittedRefs: string[];
  /** True when the first response was unparseable JSON (vs a partial result set). */
  parseFailed: boolean;
};

export type CoverageShortfallHandler = (info: BatchCoverageShortfall) => void | Promise<void>;

export type BatchCoverageOutcome<R> = {
  /** Merged results (first answer wins per ref; retry fills only omitted refs). */
  results: R[];
  /** Refs STILL missing after the retry — fail-safe defaults apply to these. */
  omittedRefs: string[];
  /** Whether the single re-ask happened. */
  reasked: boolean;
  /** Whether the first response was unparseable JSON. */
  parseFailed: boolean;
};

/** Input refs with no result echoed back (ignores results for unknown refs). */
export function omittedBatchRefs(
  inputs: { ref: string }[],
  results: { ref: string }[],
): string[] {
  const seen = new Set(results.map((r) => r.ref));
  return inputs.filter((i) => !seen.has(i.ref)).map((i) => i.ref);
}

/**
 * Ask once; on a coverage shortfall (parse failure or omitted refs) report it and
 * re-ask the omitted refs exactly once. Never retries a second time — remaining gaps
 * are returned in `omittedRefs` for the caller's fail-safe coverage finalize.
 */
export async function askBatchWithCoverageRetry<I extends { ref: string }, R extends { ref: string }>(args: {
  inputs: I[];
  /** One model round-trip for the given inputs (subset of `args.inputs` on retry). */
  ask: (inputs: I[]) => Promise<ParsedBatchResponse<R>>;
  /** Called once, before the retry, when the first ask lost refs. */
  onShortfall?: CoverageShortfallHandler;
}): Promise<BatchCoverageOutcome<R>> {
  if (args.inputs.length === 0) {
    return { results: [], omittedRefs: [], reasked: false, parseFailed: false };
  }
  const known = new Set(args.inputs.map((i) => i.ref));
  const first = await args.ask(args.inputs);

  const seen = new Set<string>();
  const results: R[] = [];
  for (const r of first.results) {
    if (!known.has(r.ref) || seen.has(r.ref)) continue;
    seen.add(r.ref);
    results.push(r);
  }

  let omitted = args.inputs.filter((i) => !seen.has(i.ref));
  if (omitted.length === 0) {
    return { results, omittedRefs: [], reasked: false, parseFailed: first.parseFailed };
  }

  await args.onShortfall?.({
    omittedRefs: omitted.map((i) => i.ref),
    parseFailed: first.parseFailed,
  });

  const retry = await args.ask(omitted);
  for (const r of retry.results) {
    if (!known.has(r.ref) || seen.has(r.ref)) continue;
    seen.add(r.ref);
    results.push(r);
  }
  omitted = args.inputs.filter((i) => !seen.has(i.ref));
  return {
    results,
    omittedRefs: omitted.map((i) => i.ref),
    reasked: true,
    parseFailed: first.parseFailed,
  };
}

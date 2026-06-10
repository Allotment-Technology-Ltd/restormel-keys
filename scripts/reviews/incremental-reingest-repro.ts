/**
 * Stage 3.2 — incremental re-ingest repro (no LLM keys required).
 *
 * Demonstrates the re-ingest contract of docs/decisions/verified-memory-incremental-ingest.md
 * §3 using only pure functions from @restormel/connect-core, with a counting stub in place
 * of every model call:
 *   1. UNCHANGED source — content hash match ⇒ the document is skipped entirely:
 *      zero extraction calls, zero judge calls (the only write is a last_seen_at touch);
 *   2. CHANGED source — deterministic claim identity (claim_key = hash(source_key +
 *      normalized evidence quote)) diffs the document's claims into carried / changed /
 *      added / removed; ONLY changed + added claims reach the judge;
 *   3. REMOVED claims — superseded with a closed validity window and a provenance chain
 *      (superseded_by links forward); reversible, never orphaned, never silently kept.
 *
 * Run: pnpm exec tsx scripts/reviews/incremental-reingest-repro.ts
 *
 * This is a REVIEW AID, not a test (the runner-level call-count assertions live in
 * apps/dashboard/src/lib/server/connect/ingest-full-runner.test.ts). It exits non-zero
 * only if one of the ADR properties does not hold.
 */
import { contentHash } from "../../packages/connect-core/src/ingest/evidence-binding.js";
import {
  buildSupersessionTrace,
  computeClaimKey,
  deriveClaimSourceKey,
  planIncrementalReingest,
  type ClaimVersionChainRow,
  type PriorClaimVersion,
} from "../../packages/connect-core/src/ingest/claim-identity.js";

function hr(title: string): void {
  console.log("\n" + "═".repeat(72) + "\n" + title + "\n" + "─".repeat(72));
}

function assertProperty(name: string, ok: boolean): void {
  console.log(`  ${ok ? "✓" : "✗ FAILED"} ${name}`);
  if (!ok) process.exitCode = 1;
}

// ── The source document, two versions ─────────────────────────────────────────

const DOC_V1 =
  "Bentham founded classical utilitarianism. Mill ranked higher pleasures above lower ones. " +
  "Kant wrote the groundwork.";
const DOC_V2 =
  "Bentham founded classical utilitarianism. Mill ranked higher pleasures above lower ones. " +
  "Sidgwick systematised the doctrine.";

// What a (stubbed) extractor returns per document version: claim text + evidence quote.
const EXTRACTED_V1 = [
  { unitId: "u-1", text: "Bentham founded classical utilitarianism.", quote: "Bentham founded classical utilitarianism." },
  { unitId: "u-2", text: "Mill ranked higher pleasures above lower bodily pleasures.", quote: "Mill ranked higher pleasures above lower ones." },
  { unitId: "u-3", text: "Kant wrote the groundwork of the metaphysics of morals.", quote: "Kant wrote the groundwork." },
];
const EXTRACTED_V2 = [
  // Same claim, same quote (modulo whitespace drift) → CARRIED, never re-judged.
  { unitId: "u-4", text: "Bentham founded classical utilitarianism.", quote: "Bentham  founded classical utilitarianism." },
  // Same quote, reworded claim text → CHANGED, new version, re-judged (this one only).
  { unitId: "u-5", text: "Mill ranked the higher pleasures strictly above the lower.", quote: "Mill ranked higher pleasures above lower ones." },
  // New claim → ADDED, fully verified.
  { unitId: "u-6", text: "Sidgwick systematised utilitarian doctrine.", quote: "Sidgwick systematised the doctrine." },
  // Kant's claim does not reappear → REMOVED, superseded.
];

// Every model call in the pipeline goes through this counter in the repro.
const modelCalls = { extraction: 0, judge: 0 };

async function main(): Promise<void> {
  const sourceKey = deriveClaimSourceKey({ url: "https://example.com/utilitarianism" });
  console.log(`source_key: ${sourceKey}`);

  /* ───────────────────── First ingest: version-1 claims ───────────────────── */
  hr("0. First ingest — version 1 of every claim, judged once");
  modelCalls.extraction += 1; // extractor ran over DOC_V1
  modelCalls.judge += EXTRACTED_V1.length;
  const storedHash = await contentHash(DOC_V1);
  const priorClaims: PriorClaimVersion[] = [];
  for (const u of EXTRACTED_V1) {
    priorClaims.push({
      versionId: `v-${priorClaims.length + 1}`,
      claimKey: await computeClaimKey({ sourceKey, evidenceQuote: u.quote, text: u.text }),
      versionNo: 1,
      unitId: u.unitId,
      text: u.text,
      verificationState: "supported",
      judgedBy: "judge#run1",
      judgedAt: "2026-06-10T00:00:00.000Z",
      validationStatus: "ok",
      validationNote: null,
    });
  }
  console.log(`  stored source hash: ${storedHash.slice(0, 16)}…`);
  console.log(`  ${priorClaims.length} claim version(s) at v1, all "supported"`);
  console.log(`  model calls so far: extraction=${modelCalls.extraction} judge=${modelCalls.judge}`);

  /* ───────────────── 1. Unchanged source: skip entirely ───────────────────── */
  hr("1. Re-ingest, UNCHANGED source — hash match ⇒ skipped, zero model calls");
  const before = { ...modelCalls };
  const probeHash = await contentHash(DOC_V1);
  if (probeHash === storedHash) {
    console.log("  content hash matches the stored source version — document skipped");
    console.log("  (the only write performed is a last_seen_at touch)");
  } else {
    modelCalls.extraction += 1; // would re-extract — must not happen
  }
  assertProperty(
    "zero extraction calls and zero judge calls on the unchanged re-ingest",
    modelCalls.extraction === before.extraction && modelCalls.judge === before.judge,
  );

  /* ───────────────── 2. Changed source: deterministic diff ────────────────── */
  hr("2. Re-ingest, CHANGED source — diff to carried / changed / added / removed");
  const probeHash2 = await contentHash(DOC_V2);
  console.log(`  new hash ${probeHash2.slice(0, 16)}… ≠ stored ${storedHash.slice(0, 16)}… ⇒ re-extract THIS document only`);
  modelCalls.extraction += 1;
  const nextClaims = [];
  for (const u of EXTRACTED_V2) {
    nextClaims.push({
      unitId: u.unitId,
      text: u.text,
      claimKey: await computeClaimKey({ sourceKey, evidenceQuote: u.quote, text: u.text }),
    });
  }
  const plan = planIncrementalReingest({ prior: priorClaims, next: nextClaims });
  console.log(`  carried : ${plan.carried.map((c) => `"${c.next.text}"`).join(", ")}`);
  console.log(`  changed : ${plan.changed.map((c) => `"${c.next.text}"`).join(", ")}`);
  console.log(`  added   : ${plan.added.map((a) => `"${a.text}"`).join(", ")}`);
  console.log(`  removed : ${plan.removed.map((r) => `"${r.text}"`).join(", ")}`);
  assertProperty(
    "diff is 1 carried / 1 changed / 1 added / 1 removed",
    plan.carried.length === 1 && plan.changed.length === 1 && plan.added.length === 1 && plan.removed.length === 1,
  );

  // Only changed + added claims reach the judge; carried keep their verdict.
  const judged = [...plan.changed.map((c) => c.next), ...plan.added];
  modelCalls.judge += judged.length;
  console.log(`  judge sees ${judged.length} claim(s): ${judged.map((j) => j.unitId).join(", ")}`);
  const carried = plan.carried[0]!;
  console.log(
    `  carried claim keeps its verdict: ${carried.prior.verificationState} ` +
      `(judged by ${carried.prior.judgedBy} at ${carried.prior.judgedAt} — unchanged)`,
  );
  assertProperty(
    "re-validation cost is O(changed claims) — the carried claim is never re-judged",
    judged.every((j) => j.unitId !== carried.next.unitId),
  );

  /* ─────────── 3. Supersession: reversible, provenance-chained ───────────── */
  hr("3. Supersession — closed validity windows, forward-linked chain");
  // New version rows for V2 (what setEvidence writes), then close the replaced/removed.
  const newVersionIdByUnit = new Map(EXTRACTED_V2.map((u, i) => [u.unitId, `v-${10 + i}`]));
  const chainRows: ClaimVersionChainRow[] = [];
  const closedAt = new Date().toISOString();
  for (const { next, prior } of [...plan.carried, ...plan.changed]) {
    chainRows.push(
      {
        versionId: prior.versionId,
        versionNo: prior.versionNo,
        unitId: prior.unitId,
        text: prior.text,
        verificationState: prior.verificationState,
        sourceHash: storedHash,
        validFrom: "2026-06-10T00:00:00.000Z",
        validTo: closedAt,
        supersededBy: newVersionIdByUnit.get(next.unitId) ?? null,
      },
      {
        versionId: newVersionIdByUnit.get(next.unitId)!,
        versionNo: prior.versionNo + 1,
        unitId: next.unitId,
        text: next.text,
        verificationState: plan.carried.includes(plan.carried[0]!) && next.unitId === carried.next.unitId ? prior.verificationState : "unverified",
        sourceHash: probeHash2,
        validFrom: closedAt,
        validTo: null,
        supersededBy: null,
      },
    );
  }
  const removed = plan.removed[0]!;
  const removedRow: ClaimVersionChainRow = {
    versionId: removed.versionId,
    versionNo: removed.versionNo,
    unitId: removed.unitId,
    text: removed.text,
    verificationState: removed.verificationState,
    sourceHash: storedHash,
    validFrom: "2026-06-10T00:00:00.000Z",
    validTo: closedAt,
    supersededBy: null, // no successor — the claim left the source
  };

  // Provenance trace for the carried claim's chain (v1 → v2).
  const carriedChain = chainRows.filter((r) => r.unitId === carried.prior.unitId || r.unitId === carried.next.unitId);
  const trace = buildSupersessionTrace(carriedChain);
  console.log("  carried claim's supersession chain:");
  for (const link of trace.chain) {
    console.log(
      `    v${link.versionNo} [${link.versionId}] ${link.validTo ? `valid → ${link.validTo}` : "CURRENT"}` +
        (link.supersededBy ? ` superseded_by → ${link.supersededBy}` : ""),
    );
  }
  assertProperty("chain is intact (every closed version links to an existing successor)", trace.intact);
  assertProperty("exactly one CURRENT version per surviving claim", trace.current?.versionNo === 2);

  const removedTrace = buildSupersessionTrace([removedRow]);
  console.log(`  removed claim: "${removedRow.text}"`);
  console.log(
    `    v${removedRow.versionNo} [${removedRow.versionId}] valid → ${removedRow.validTo} (no successor)`,
  );
  assertProperty(
    "removed claim is superseded (closed, reversible) — not orphaned, not silently kept",
    removedTrace.current === null && removedTrace.intact,
  );

  hr("Summary");
  console.log(`  total model calls — extraction: ${modelCalls.extraction} (1 first ingest + 1 changed doc),`);
  console.log(`                      judge:      ${modelCalls.judge} (3 first ingest + 2 changed/new; carried never re-judged)`);
  console.log(`  exit code: ${process.exitCode ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

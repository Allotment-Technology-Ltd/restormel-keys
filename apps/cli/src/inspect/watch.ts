/**
 * watch — continuous inspect mode. After the initial render, polls the graph at
 * a fixed interval and prints a diff of what changed (claims added, claims whose
 * verification state changed, claims removed). Useful during active ingestion.
 */
import chalk from "chalk";
import type { ClaimView, InspectResult } from "./types.js";

type Runner = () => Promise<InspectResult>;

interface Snapshot {
  byId: Map<string, ClaimView>;
}

function snapshot(result: InspectResult): Snapshot {
  const byId = new Map<string, ClaimView>();
  for (const c of result.wouldRetrieve) byId.set(c.claimId, c);
  return { byId };
}

/** Compute a human diff between two snapshots; empty array means "no change". */
function diff(prev: Snapshot, next: Snapshot): string[] {
  const out: string[] = [];
  for (const [id, claim] of next.byId) {
    const before = prev.byId.get(id);
    if (!before) {
      out.push(chalk.green(`+ added [${claim.category}] ${claim.claimText.slice(0, 80)}`));
    } else if (before.verificationState !== claim.verificationState) {
      out.push(
        chalk.yellow(
          `~ changed ${id}: ${before.verificationState} → ${claim.verificationState}`,
        ),
      );
    }
  }
  for (const [id, claim] of prev.byId) {
    if (!next.byId.has(id)) {
      out.push(chalk.red(`- removed ${id}: ${claim.claimText.slice(0, 80)}`));
    }
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an inspect in watch mode. `render` prints the full initial result; each
 * subsequent poll prints only the diff. Loops until the process is interrupted.
 */
export async function runWatch(
  run: Runner,
  render: (result: InspectResult) => void,
  intervalMs: number,
): Promise<void> {
  let prev = snapshot(await runAndRender(run, render));

  process.stderr.write(
    chalk.dim(`\nWatching for changes every ${Math.round(intervalMs / 1000)}s — press Ctrl+C to stop.\n`),
  );

  for (;;) {
    await sleep(intervalMs);
    let result: InspectResult;
    try {
      result = await run();
    } catch (err) {
      process.stderr.write(chalk.red(`watch: poll failed: ${err instanceof Error ? err.message : String(err)}\n`));
      continue;
    }
    const next = snapshot(result);
    const changes = diff(prev, next);
    const stamp = new Date().toLocaleTimeString();
    if (changes.length === 0) {
      process.stderr.write(chalk.dim(`[${stamp}] no changes\n`));
    } else {
      process.stderr.write(chalk.bold(`\n[${stamp}] ${changes.length} change(s):\n`));
      for (const line of changes) process.stderr.write(`  ${line}\n`);
    }
    prev = next;
  }
}

async function runAndRender(run: Runner, render: (r: InspectResult) => void): Promise<InspectResult> {
  const result = await run();
  render(result);
  return result;
}

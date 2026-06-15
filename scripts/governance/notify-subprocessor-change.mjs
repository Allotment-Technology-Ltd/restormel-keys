#!/usr/bin/env node
/**
 * notify-subprocessor-change.mjs — fire the customer sub-processor change-notification
 * (UK GDPR Art 28) when governance/suppliers.yaml changes on main. Phase 5 (REC-PLAN-005).
 *
 * Dependency-free (plain node on the Forgejo runner). NON-BLOCKING: it always logs the
 * notification + writes a job summary; it POSTs to $SUBPROCESSOR_NOTIFY_WEBHOOK if that
 * secret is configured, and never fails the pipeline if delivery is unavailable.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const FILE = "governance/suppliers.yaml";
const sh = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" });
  } catch {
    return "";
  }
};

// Diff range: the push's before..HEAD when available, else HEAD~1..HEAD.
const before =
  process.env.BEFORE_SHA && /^[0-9a-f]{7,40}$/.test(process.env.BEFORE_SHA) && !/^0+$/.test(process.env.BEFORE_SHA)
    ? process.env.BEFORE_SHA
    : "HEAD~1";
const diff = sh(["diff", before, "HEAD", "--", FILE]) || sh(["show", "HEAD", "--", FILE]);

const added = new Set();
const removed = new Set();
for (const line of diff.split("\n")) {
  const m = line.match(/^([+-])\s*-?\s*name:\s*(.+)$/);
  if (m) (m[1] === "+" ? added : removed).add(m[2].replace(/^["']|["']$/g, "").trim());
}
const changed = [...added].filter((n) => removed.has(n)); // present on both sides = modified
const trueAdded = [...added].filter((n) => !removed.has(n));
const trueRemoved = [...removed].filter((n) => !added.has(n));

const date = new Date().toISOString().slice(0, 10);
const sha = sh(["rev-parse", "HEAD"]).trim().slice(0, 8);
const server = process.env.SERVER_URL || "https://git.allotmentology.tech";
const repo = process.env.REPO || "Allotment-Technology-Ltd/restormel-keys";
const commitUrl = `${server}/${repo}/commit/${sha}`;

const lines = [`Restormel sub-processor register updated (${date}).`];
if (trueAdded.length) lines.push(`Added sub-processor(s): ${trueAdded.join(", ")}.`);
if (trueRemoved.length) lines.push(`Removed sub-processor(s): ${trueRemoved.join(", ")}.`);
if (changed.length) lines.push(`Changed entr${changed.length > 1 ? "ies" : "y"}: ${changed.join(", ")}.`);
if (!trueAdded.length && !trueRemoved.length && !changed.length)
  lines.push("Register edited (see the commit for details).");
lines.push(`Per UK GDPR Art 28, customers are entitled to notice of sub-processor changes. Review: ${commitUrl}`);
const message = lines.join("\n");

console.log("::group::sub-processor change notification");
console.log(message);
console.log("::endgroup::");

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Sub-processor change notification\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`,
  );
}

const webhook = process.env.SUBPROCESSOR_NOTIFY_WEBHOOK;
if (webhook) {
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "subprocessor.changed",
        date,
        added: trueAdded,
        removed: trueRemoved,
        changed,
        commit: sha,
        url: commitUrl,
        text: message,
      }),
    });
    console.log(`notify webhook: HTTP ${res.status}`);
  } catch (e) {
    console.log(`::warning::notify webhook failed (${e?.message || e}) — notification logged above; not blocking the pipeline.`);
  }
} else {
  console.log(
    "::notice::SUBPROCESSOR_NOTIFY_WEBHOOK not set — notification logged to the job summary only. Set the secret to deliver to a channel/customer-notification service.",
  );
}
process.exit(0);

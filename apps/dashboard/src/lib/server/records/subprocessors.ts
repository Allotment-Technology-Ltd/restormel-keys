/**
 * Published view of the sub-processor register (`governance/suppliers.yaml`) for /legal/sub-processors.
 * Server-only, build-time. Exposes ONLY the customer-facing fields (name, what they provide, role,
 * location) — internal fields (DPA status, processing detail, notes) are not published.
 *
 * Minimal parser (no YAML dependency) consistent with the dependency-free records tooling.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const SUPPLIERS = join(REPO_ROOT, "governance/suppliers.yaml");

export interface SubProcessor {
  name: string;
  provides: string;
  role: string;
  location: string;
}

const unquote = (v: string): string => v.trim().replace(/^["']|["']$/g, "");

export function loadSubProcessors(): SubProcessor[] {
  let text = "";
  try {
    text = readFileSync(SUPPLIERS, "utf8");
  } catch {
    return [];
  }
  const subs: SubProcessor[] = [];
  let cur: Partial<SubProcessor> | null = null;
  let inSuppliers = false;
  const push = () => {
    if (cur?.name) subs.push({ name: cur.name, provides: cur.provides ?? "", role: cur.role ?? "", location: cur.location ?? "" });
  };
  for (const line of text.split(/\r?\n/)) {
    if (/^suppliers:\s*$/.test(line)) {
      inSuppliers = true;
      continue;
    }
    if (!inSuppliers) continue;
    if (/^[A-Za-z]/.test(line)) break; // left the suppliers block (a new top-level key)
    const nameM = line.match(/^\s*-\s*name:\s*(.+)$/);
    if (nameM) {
      push();
      cur = { name: unquote(nameM[1]) };
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^\s+(provides|role|location):\s*(.+)$/);
    if (m) cur[m[1] as "provides" | "role" | "location"] = unquote(m[2]);
  }
  push();
  return subs;
}

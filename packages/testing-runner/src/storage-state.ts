import { dirname, isAbsolute, resolve } from "node:path";
import type { EnvironmentProfile } from "@restormel/testing-core";
import { isPathContainedInRoot } from "@restormel/testing-core";

/**
 * Resolve Playwright storage state path for `auth_mode: storage_state`.
 * - `auth_ref: env:VAR` — path read from `process.env.VAR` (trimmed).
 * - Otherwise — path relative to the config file directory, or absolute if `auth_ref` is absolute.
 */
export function resolveStorageStatePath(
  profile: EnvironmentProfile,
  configFilePath: string,
): string | undefined {
  if (profile.authMode !== "storage_state" || profile.authRef === undefined || profile.authRef === "") {
    return undefined;
  }
  const ref = profile.authRef.trim();
  if (ref.startsWith("env:")) {
    const varName = ref.slice("env:".length).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(varName)) return undefined;
    const p = process.env[varName]?.trim();
    if (!p || p.length === 0) return undefined;
    // Operator-controlled env (CI/local); not constrained to cwd so /tmp or home paths work.
    return resolve(p);
  }
  const baseAbs = resolve(dirname(configFilePath));
  const candidateAbs = isAbsolute(ref) ? resolve(ref) : resolve(baseAbs, ref);
  if (!isAbsolute(ref)) {
    if (!isPathContainedInRoot(baseAbs, candidateAbs)) return undefined;
    return candidateAbs;
  }
  // Absolute path from config: trusted commit; relative forms still cannot escape config dir.
  return candidateAbs;
}

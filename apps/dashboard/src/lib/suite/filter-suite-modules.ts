/**
 * Client-safe suite module filtering (no $lib/server imports).
 * Used by marketing docs layout and re-exported from module-gates on the server.
 */
import type { ModuleFlags } from "$lib/module-flags-types";
import { SUITE_MODULES, type SuiteModule } from "$lib/suite/suite-modules";

export function filterSuiteModulesForFlags(flags: ModuleFlags): SuiteModule[] {
  return SUITE_MODULES.filter((mod) => {
    if (mod.id === "keys") return true;
    if (mod.id === "connect") return flags.connect;
    if (mod.id === "testing") return flags.testing;
    if (mod.id === "graph") return flags.graph !== "disabled";
    return true;
  });
}

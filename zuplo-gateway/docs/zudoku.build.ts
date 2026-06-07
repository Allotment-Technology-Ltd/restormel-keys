import type { ZudokuBuildConfig } from "zudoku";

// Zuplo's managed dev-portal builder is memory-constrained. zudoku defaults
// prerender to 80% of CPU cores; on a many-core builder that spawns enough
// parallel workers (each loading the SSR bundle) to add memory pressure. Cap
// the worker count to keep peak memory bounded. (The primary OOM fix is the
// heap-boost re-exec in scripts/apply-zudoku-ui-patches.mjs.)
const buildConfig: ZudokuBuildConfig = {
  prerender: {
    workers: 2,
  },
};

export default buildConfig;

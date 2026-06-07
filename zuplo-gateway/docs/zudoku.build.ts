import type { ZudokuBuildConfig } from "zudoku";

// Zuplo's managed dev-portal builder is memory-constrained. zudoku defaults
// prerender to 80% of CPU cores; on a many-core builder that spawns enough
// parallel workers (each loading the SSR bundle) to OOM the build. Cap the
// worker count to keep peak memory bounded.
const buildConfig: ZudokuBuildConfig = {
  prerender: {
    workers: 2,
  },
};

export default buildConfig;

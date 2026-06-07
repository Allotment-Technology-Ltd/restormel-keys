import type { ZudokuBuildConfig } from "zudoku";

// Bound peak build memory: one prerender worker, and (via the sourcemap patch in
// scripts/apply-zudoku-ui-patches.mjs) no build-time source maps. The dev-portal
// build still needs ~1.3GB of V8 heap; Zuplo's build-step sandbox must provide
// it (see that file's notes / the open Zuplo support thread).
const buildConfig: ZudokuBuildConfig = {
  prerender: {
    workers: 1,
  },
};

export default buildConfig;

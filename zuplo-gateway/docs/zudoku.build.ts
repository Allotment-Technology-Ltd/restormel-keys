import type { ZudokuBuildConfig } from "zudoku";
import { spawnSync } from "node:child_process";
import { isMainThread } from "node:worker_threads";

/**
 * Heap boost for Zuplo's dev-portal builder.
 *
 * Zuplo runs `zudoku build` in a managed Node environment with the default
 * old-space heap (~1GB under its ~2GB build container). This portal's SSR
 * build peaks around ~1.3GB and OOMs ("Failed to build Developer Portal",
 * with no further error). Zuplo confirmed there is no supported way to pass
 * NODE_OPTIONS into the portal build, but that `zudoku.build.ts` runs in Node
 * at build time and is the supported hook for build-time logic.
 *
 * So on the first (un-boosted) main-thread `build` invocation we re-exec the
 * exact same command with a larger --max-old-space-size and exit with the
 * child's status. The child sets __ZUDOKU_HEAP_BOOSTED, so it skips this block
 * and builds normally with the larger heap. Prerender workers (not the main
 * thread) and any nested invocation are excluded so we never recurse.
 *
 * If the sandbox blocks spawning a child, we fall through and let the normal
 * (un-boosted) build run — no worse than before.
 */
if (
  isMainThread &&
  !process.env.__ZUDOKU_HEAP_BOOSTED &&
  process.argv.includes("build")
) {
  const res = spawnSync(
    process.execPath,
    ["--max-old-space-size=1536", ...process.argv.slice(1)],
    { stdio: "inherit", env: { ...process.env, __ZUDOKU_HEAP_BOOSTED: "1" } },
  );
  if (!res.error) {
    process.exit(res.status ?? 1);
  }
  // child_process unavailable in the sandbox — continue with the default heap.
  console.warn("[heap-boost] re-exec unavailable, continuing:", res.error.message);
}

const buildConfig: ZudokuBuildConfig = {
  // One prerender worker keeps peak memory bounded so the boosted build fits
  // comfortably inside the ~2GB builder (parent + boosted child + worker).
  prerender: {
    workers: 1,
  },
};

export default buildConfig;

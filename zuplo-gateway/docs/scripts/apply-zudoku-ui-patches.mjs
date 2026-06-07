/**
 * Zudoku ProfileMenu renders Logout twice: once from CoreAuthenticationPlugin
 * (with icon) and again as a hardcoded link. Remove the duplicate.
 * Idempotent — safe to run on every install.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const headerPath = path.join(root, "node_modules/zudoku/src/lib/components/Header.tsx");

const DUPLICATE_LOGOUT = `            <DropdownMenuSeparator />
            <Link to="/signout">
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </Link>
`;

try {
  if (!fs.existsSync(headerPath)) {
    console.warn("[apply-zudoku-ui-patches] zudoku Header.tsx not found, skip");
  } else {
    let s = fs.readFileSync(headerPath, "utf8");
    if (s.includes(DUPLICATE_LOGOUT.trim())) {
      s = s.replace(DUPLICATE_LOGOUT, "");
      fs.writeFileSync(headerPath, s);
      console.log("[apply-zudoku-ui-patches] removed duplicate Logout in zudoku Header.tsx");
    }
  }
} catch (e) {
  console.warn("[apply-zudoku-ui-patches]", e);
}

/**
 * Disable build-time source maps. zudoku hardcodes `sourcemap: true` in its
 * Vite build config (dist/cli/cli.js); generating the multi-MB maps inflates
 * peak memory in the SSR build phase and OOMs Zuplo's memory-constrained
 * dev-portal builder. We don't ship/serve these maps, so turning them off is a
 * pure memory win. Idempotent; silently no-ops if zudoku changes the string.
 */
try {
  const cliPath = path.join(root, "node_modules/zudoku/dist/cli/cli.js");
  if (fs.existsSync(cliPath)) {
    let c = fs.readFileSync(cliPath, "utf8");
    if (c.includes("sourcemap: true")) {
      c = c.replaceAll("sourcemap: true", "sourcemap: false");
      fs.writeFileSync(cliPath, c);
      console.log("[apply-zudoku-ui-patches] disabled build sourcemaps in zudoku cli.js");
    }
  }
} catch (e) {
  console.warn("[apply-zudoku-ui-patches] sourcemap patch skipped:", e);
}

/**
 * Heap boost — secondary path. The primary heap boost is the re-exec in
 * docs/zudoku.build.ts (the build-time hook Zuplo confirmed is supported). This
 * additionally patches zudoku's CLI bin entry to re-exec with a larger
 * --max-old-space-size: when Zuplo launches the build through the bin, the
 * re-exec happens here first (with a tiny parent process), giving more memory
 * headroom than re-execing from zudoku.build.ts. Both share __ZUDOKU_HEAP_BOOSTED
 * so only one re-exec ever happens. Falls through if the sandbox blocks spawning.
 * Idempotent; no-ops if already patched or if the entry shape changes.
 */
try {
  const binPath = path.join(root, "node_modules/zudoku/cli.js");
  if (fs.existsSync(binPath)) {
    let c = fs.readFileSync(binPath, "utf8");
    const marker = "__ZUDOKU_HEAP_BOOSTED";
    const importLine = 'await import("./dist/cli/cli.js");';
    if (!c.includes(marker) && c.includes(importLine)) {
      const shim = `if (!process.env.${marker}) {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const res = spawnSync(process.execPath, ["--max-old-space-size=1536", fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, ${marker}: "1" } });
  if (!res.error) process.exit(res.status ?? 1);
}
`;
      c = c.replace(importLine, shim + importLine);
      fs.writeFileSync(binPath, c);
      console.log("[apply-zudoku-ui-patches] added heap-boost re-exec to zudoku cli.js");
    }
  }
} catch (e) {
  console.warn("[apply-zudoku-ui-patches] heap-boost patch skipped:", e);
}

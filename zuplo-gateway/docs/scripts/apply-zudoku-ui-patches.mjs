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
 * Disable build-time source maps. zudoku hardcodes `sourcemap: true` in its Vite
 * build config (dist/cli/cli.js); the multi-MB maps are pure build overhead we
 * don't ship. Idempotent; silently no-ops if zudoku changes the string.
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

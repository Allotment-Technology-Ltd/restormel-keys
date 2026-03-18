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
    process.exit(0);
  }
  let s = fs.readFileSync(headerPath, "utf8");
  if (!s.includes(DUPLICATE_LOGOUT.trim())) {
    process.exit(0);
  }
  s = s.replace(DUPLICATE_LOGOUT, "");
  fs.writeFileSync(headerPath, s);
  console.log("[apply-zudoku-ui-patches] removed duplicate Logout in zudoku Header.tsx");
} catch (e) {
  console.warn("[apply-zudoku-ui-patches]", e);
  process.exit(0);
}

#!/usr/bin/env node
/**
 * Scaffold a new Restormel module from platform/template-restormel-module.
 *
 * Usage:
 *   node scripts/init-restormel-module.mjs --out <dir> --slug <kebab> --title "<name>" [--path <url-segment>] [--platform-repo <path-to-restormel-platform>]
 *
 * @see docs/restormel-module-default-stack.md
 * @see docs/template-restormel-module-repo.md
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const TEMPLATE = path.join(REPO_ROOT, "platform", "template-restormel-module");

const PLACEHOLDER_ROOT_PKG = "__ROOT_PKG_NAME__";
const PLACEHOLDER_APP_PKG = "__APP_PKG_NAME__";
const PLACEHOLDER_SLUG = "__MODULE_SLUG__";
const PLACEHOLDER_TITLE = "__MODULE_TITLE__";
const PLACEHOLDER_PATH = "__MODULE_PATH__";

function parseArgs(argv) {
  const out = { platformRepo: null, urlPath: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out.dir = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--title") out.title = argv[++i];
    else if (a === "--path") out.urlPath = argv[++i];
    else if (a === "--platform-repo") out.platformRepo = argv[++i];
    else if (a === "--keys-repo") {
      console.error(
        "Removed: --keys-repo (restormel-keys no longer vendors platform/packages/tokens).\n" +
          "  Omit the flag to use @restormel/keys-tokens from npm (^0.1.0 in the template).\n" +
          "  Or pass --platform-repo <path-to-restormel-platform-clone> for file:…/packages/tokens."
      );
      process.exit(1);
    }
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

function validateSlug(slug) {
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    console.error("Invalid --slug: use kebab-case (e.g. testing, my-module).");
    process.exit(1);
  }
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === ".DS_Store") continue;
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(s);
      const resolved = path.resolve(path.dirname(s), linkTarget);
      if (!fs.existsSync(resolved)) {
        console.warn(`Skip broken symlink: ${s} -> ${linkTarget}`);
        continue;
      }
      const st = fs.statSync(resolved);
      if (st.isDirectory()) copyRecursive(resolved, d);
      else fs.copyFileSync(resolved, d);
    } else if (ent.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

const TEXT_EXT = new Set([
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".ts",
  ".js",
  ".svelte",
  ".html",
  ".css",
  ".svg",
  ".mdc",
  ".txt",
  ".sh",
]);

function shouldPatchText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  if (filePath.endsWith("action.yml")) return true;
  return false;
}

function replaceInFile(filePath, map) {
  let s = fs.readFileSync(filePath, "utf8");
  let changed = false;
  for (const [k, v] of Object.entries(map)) {
    if (s.includes(k)) changed = true;
    s = s.split(k).join(v);
  }
  if (changed) fs.writeFileSync(filePath, s, "utf8");
}

function walkAndReplace(dir, map) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkAndReplace(p, map);
    else if (shouldPatchText(p)) replaceInFile(p, map);
  }
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(`init-restormel-module — scaffold from platform/template-restormel-module

Usage:
  node scripts/init-restormel-module.mjs --out <dir> --slug <kebab> --title "<name>" [--path <url-segment>] [--platform-repo <path-to-restormel-platform>]

Examples:
  node scripts/init-restormel-module.mjs --out ../restormel-testing --slug testing --title "Restormel Testing"
  node scripts/init-restormel-module.mjs --out ../restormel-mymodule --slug mymodule --title "Restormel MyModule" --platform-repo ../restormel-platform

Options:
  --path            Public URL segment (default: same as --slug)
  --platform-repo   Clone of restormel-platform; pins @restormel/keys-tokens to file:…/packages/tokens relative to apps/web (offline / pre-publish token work). Default template uses npm ^0.1.0 when omitted.
`);
  process.exit(0);
}

if (!args.dir || !args.slug || !args.title) {
  console.error("Required: --out, --slug, --title (or --help)");
  process.exit(1);
}

validateSlug(args.slug);
const urlPath = args.urlPath || args.slug;
const rootPkg = `restormel-${args.slug}`;
const appPkg = `${args.slug}-web`;

const outDir = path.resolve(args.dir);
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
  console.error(`Output directory is not empty: ${outDir}`);
  process.exit(1);
}

if (!fs.existsSync(TEMPLATE)) {
  console.error(`Template missing: ${TEMPLATE}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
copyRecursive(TEMPLATE, outDir);

const map = {
  [PLACEHOLDER_ROOT_PKG]: rootPkg,
  [PLACEHOLDER_APP_PKG]: appPkg,
  [PLACEHOLDER_SLUG]: args.slug,
  [PLACEHOLDER_TITLE]: args.title,
  [PLACEHOLDER_PATH]: urlPath,
};

walkAndReplace(outDir, map);

const envExample = path.join(outDir, "env.example");
const envTarget = path.join(outDir, ".env.example");
if (fs.existsSync(envExample)) {
  fs.renameSync(envExample, envTarget);
}

if (args.platformRepo) {
  const platformRoot = path.resolve(args.platformRepo);
  const tokensPath = path.join(platformRoot, "packages", "tokens");
  const tokensPkg = path.join(tokensPath, "package.json");
  if (!fs.existsSync(tokensPkg)) {
    console.error(
      `No tokens package at ${tokensPath} (expected restormel-platform clone with packages/tokens/package.json)`
    );
    process.exit(1);
  }
  const webDir = path.join(outDir, "apps", "web");
  // realpathSync avoids broken file: paths when /tmp is a symlink (e.g. macOS /private/tmp).
  const webReal = fs.realpathSync(webDir);
  const tokensReal = fs.realpathSync(tokensPath);
  const rel = path.relative(webReal, tokensReal);
  const posixRel = rel.split(path.sep).join("/");
  const pkgJsonPath = path.join(webDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  pkg.dependencies["@restormel/keys-tokens"] = `file:${posixRel}`;
  fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`Set @restormel/keys-tokens to file:${posixRel} (relative to apps/web)`);
}

console.log(`\nScaffold written to: ${outDir}`);
console.log("Next: cd <dir> && pnpm install && pnpm run check && pnpm run build\n");

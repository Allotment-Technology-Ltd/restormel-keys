#!/usr/bin/env node
/**
 * Scaffold a new Restormel module from platform/template-restormel-module.
 *
 * Usage:
 *   node scripts/init-restormel-module.mjs --out <dir> --slug <kebab> --title "<name>" [--path <url-segment>] [--keys-repo <path-to-restormel-keys>]
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
  const out = { keysRepo: null, urlPath: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out.dir = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--title") out.title = argv[++i];
    else if (a === "--path") out.urlPath = argv[++i];
    else if (a === "--keys-repo") out.keysRepo = argv[++i];
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
    if (ent.isDirectory()) copyRecursive(s, d);
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
  node scripts/init-restormel-module.mjs --out <dir> --slug <kebab> --title "<name>" [--path <url-segment>] [--keys-repo <path-to-restormel-keys>]

Examples:
  node scripts/init-restormel-module.mjs --out ../restormel-testing --slug testing --title "Restormel Testing"
  node scripts/init-restormel-module.mjs --out ../restormel-testing --slug testing --title "Restormel Testing" --keys-repo ..

Options:
  --path       Public URL segment (default: same as --slug)
  --keys-repo  restormel-keys repo root; pins @restormel/keys-tokens to file:… relative to apps/web
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

if (args.keysRepo) {
  const keysRoot = path.resolve(args.keysRepo);
  const tokensPath = path.join(keysRoot, "platform", "packages", "tokens");
  const tokensPkg = path.join(tokensPath, "package.json");
  if (!fs.existsSync(tokensPkg)) {
    console.error(`No tokens package at ${tokensPath}`);
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

#!/usr/bin/env node
/**
 * Rewrite packages/cli package.json dependencies from workspace:* to ^<version>
 * so npm publish produces a consumable package. Run from repo root before npm publish.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..");
const cliPath = join(root, "packages/cli/package.json");
const doctorVer = JSON.parse(readFileSync(join(root, "packages/doctor/package.json"), "utf8")).version;
const keysVer = JSON.parse(readFileSync(join(root, "packages/core/package.json"), "utf8")).version;
const validateVer = JSON.parse(readFileSync(join(root, "packages/validate/package.json"), "utf8")).version;

const pkg = JSON.parse(readFileSync(cliPath, "utf8"));
pkg.dependencies["@restormel/doctor"] = `^${doctorVer}`;
pkg.dependencies["@restormel/keys"] = `^${keysVer}`;
pkg.dependencies["@restormel/validate"] = `^${validateVer}`;
writeFileSync(cliPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("Patched keys-cli deps:", pkg.dependencies["@restormel/doctor"], pkg.dependencies["@restormel/keys"], pkg.dependencies["@restormel/validate"]);

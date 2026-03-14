/**
 * Framework and stack detection for keys init / doctor.
 * Supports: Next.js App Router, generic React, SvelteKit, Astro.
 */
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export type FrameworkId = "next" | "react" | "sveltekit" | "astro" | "none";

export interface DetectedFramework {
  id: FrameworkId;
  name: string;
  hasAppRouter?: boolean;
  packagePaths: string[];
}

const NEXT_APP_ROUTER_MARKERS = ["app/layout.tsx", "app/layout.js", "app/page.tsx", "app/page.js"];
const REACT_MARKERS = ["react", "react-dom"];
const SVELTEKIT_MARKERS = ["@sveltejs/kit"];
const ASTRO_MARKERS = ["astro"];

export async function detectFramework(cwd: string): Promise<DetectedFramework> {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return { id: "none", name: "None", packagePaths: [] };
  }
  const raw = await readFile(pkgPath, "utf-8");
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(raw);
  } catch {
    return { id: "none", name: "None", packagePaths: [] };
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps["next"]) {
    const hasAppRouter = NEXT_APP_ROUTER_MARKERS.some((m) => existsSync(join(cwd, m)));
    return {
      id: "next",
      name: hasAppRouter ? "Next.js (App Router)" : "Next.js",
      hasAppRouter,
      packagePaths: ["@restormel/keys", "@restormel/keys-react"],
    };
  }
  if (deps["@sveltejs/kit"]) {
    return {
      id: "sveltekit",
      name: "SvelteKit",
      packagePaths: ["@restormel/keys", "@restormel/keys-svelte"],
    };
  }
  if (deps["astro"]) {
    return {
      id: "astro",
      name: "Astro",
      packagePaths: ["@restormel/keys", "@restormel/keys-elements"],
    };
  }
  if (deps["react"] || deps["react-dom"]) {
    return {
      id: "react",
      name: "React",
      packagePaths: ["@restormel/keys", "@restormel/keys-react"],
    };
  }

  return { id: "none", name: "None", packagePaths: ["@restormel/keys"] };
}

/**
 * Framework and stack detection for keys init / doctor.
 * Supports: Next.js App Router, generic React, SvelteKit, Astro.
 */
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve, sep } from "path";

export type FrameworkId = "next" | "react" | "sveltekit" | "astro" | "none";

export interface DetectedFramework {
  id: FrameworkId;
  name: string;
  hasAppRouter?: boolean;
  corePackages: string[];
  optionalUiPackages: string[];
  packagePaths: string[];
}

const NEXT_APP_ROUTER_MARKERS = ["app/layout.tsx", "app/layout.js", "app/page.tsx", "app/page.js"];

const CORE = ["@restormel/keys"] as const;

function resolveInProject(...segments: string[]): string {
  const base = resolve(process.cwd());
  const target = resolve(base, ...segments);
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    throw new Error("Path escapes project root");
  }
  return target;
}

function withPackages(
  id: FrameworkId,
  name: string,
  extras: { hasAppRouter?: boolean; optionalUi: string[] }
): DetectedFramework {
  return {
    id,
    name,
    hasAppRouter: extras.hasAppRouter,
    corePackages: [...CORE],
    optionalUiPackages: extras.optionalUi,
    packagePaths: [...CORE, ...extras.optionalUi],
  };
}

export async function detectFramework(): Promise<DetectedFramework> {
  let pkgPath: string;
  try {
    pkgPath = resolveInProject("package.json");
  } catch {
    return {
      id: "none",
      name: "None",
      corePackages: [],
      optionalUiPackages: [],
      packagePaths: [],
    };
  }
  if (!existsSync(pkgPath)) {
    return {
      id: "none",
      name: "None",
      corePackages: [],
      optionalUiPackages: [],
      packagePaths: [],
    };
  }
  const raw = await readFile(pkgPath, "utf-8");
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(raw);
  } catch {
    return {
      id: "none",
      name: "None",
      corePackages: [],
      optionalUiPackages: [],
      packagePaths: [],
    };
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps["next"]) {
    const hasAppRouter = NEXT_APP_ROUTER_MARKERS.some((m) => {
      try {
        return existsSync(resolveInProject(m));
      } catch {
        return false;
      }
    });
    return withPackages("next", hasAppRouter ? "Next.js (App Router)" : "Next.js", {
      hasAppRouter,
      optionalUi: ["@restormel/keys-react", "@restormel/keys-elements"],
    });
  }
  if (deps["@sveltejs/kit"]) {
    return withPackages("sveltekit", "SvelteKit", { optionalUi: ["@restormel/keys-svelte"] });
  }
  if (deps["astro"]) {
    return withPackages("astro", "Astro", { optionalUi: ["@restormel/keys-elements"] });
  }
  if (deps["react"] || deps["react-dom"]) {
    return withPackages("react", "React", { optionalUi: ["@restormel/keys-react"] });
  }

  return withPackages("none", "None", { optionalUi: [] });
}

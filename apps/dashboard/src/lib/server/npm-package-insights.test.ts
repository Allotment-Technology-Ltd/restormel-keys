import { describe, expect, it } from "vitest";
import {
  compareSemverDesc,
  librariesIoNpmPathSegment,
  partitionMonorepo,
  type DependentRepo,
} from "./npm-package-insights";

describe("librariesIoNpmPathSegment", () => {
  it("percent-encodes scoped package names", () => {
    expect(librariesIoNpmPathSegment("@restormel/keys")).toBe("%40restormel%2Fkeys");
  });
});

describe("compareSemverDesc", () => {
  it("sorts higher versions first", () => {
    expect(compareSemverDesc("0.2.14", "0.2.13")).toBeLessThan(0);
    expect(compareSemverDesc("0.2.13", "0.2.14")).toBeGreaterThan(0);
    expect(compareSemverDesc("1.0.0", "1.0.0")).toBe(0);
  });
});

describe("partitionMonorepo", () => {
  const mk = (fullName: string): DependentRepo => ({
    fullName,
    repoUrl: `https://github.com/${fullName}`,
    description: null,
    language: "TypeScript",
    stars: 1,
    pushedAt: null,
  });

  it("drops the configured monorepo full name", () => {
    const repos = [mk("Allotment-Technology-Ltd/restormel-keys"), mk("acme/widget")];
    const { externalRepos } = partitionMonorepo(repos, "Allotment-Technology-Ltd/restormel-keys");
    expect(externalRepos.map((r) => r.fullName)).toEqual(["acme/widget"]);
  });

  it("is case-insensitive for monorepo match", () => {
    const repos = [mk("allotment-technology-ltd/restormel-keys")];
    const { externalRepos } = partitionMonorepo(repos, "Allotment-Technology-Ltd/restormel-keys");
    expect(externalRepos).toHaveLength(0);
  });
});

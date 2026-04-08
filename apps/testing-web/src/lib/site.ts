/**
 * Public URLs for marketing and cross-suite navigation.
 * Set PUBLIC_GITHUB_REPO_URL at build time to override the default repo link.
 */
const fallbackGithub = "https://github.com/Allotment-Technology-Ltd/restormel-testing";

const fromEnv = import.meta.env.PUBLIC_GITHUB_REPO_URL;
export const githubRepoUrl =
  typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : fallbackGithub;

/** Suite root (same origin as Keys when deployed on restormel.dev). */
export const suiteHomeUrl = "https://restormel.dev/";

/** This app under the suite domain (Keys rewrites `/testing` to the Testing Vercel deployment). */
const fallbackTestingSuite = "https://restormel.dev/testing";
const fromEnvTestingSuite = import.meta.env.PUBLIC_SUITE_TESTING_URL;
export const testingSuiteUrl =
  typeof fromEnvTestingSuite === "string" && fromEnvTestingSuite.length > 0
    ? fromEnvTestingSuite.replace(/\/$/, "")
    : fallbackTestingSuite;

export const keysHomeUrl = "https://restormel.dev/keys";
export const keysDocsUrl = "https://restormel.dev/keys/docs";

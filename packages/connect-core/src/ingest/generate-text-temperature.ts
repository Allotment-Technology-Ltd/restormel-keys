import type { StageKey } from "../ports.js";

/**
 * Whether `generateText` should omit `temperature` for this call.
 */
export function shouldOmitGenerateTextTemperature(
  stage: StageKey,
  routingProvider: string,
  modelId: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const stagesFilter = (env.INGEST_OMIT_LLM_TEMPERATURE_STAGES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const stageOk = stagesFilter.length === 0 || stagesFilter.includes(stage);
  if (!stageOk) return false;

  const g = (env.INGEST_OMIT_LLM_TEMPERATURE ?? "").trim().toLowerCase();
  if (g === "1" || g === "true" || g === "yes") return true;

  const mid = modelId.toLowerCase();
  const subStrs = (env.INGEST_OMIT_LLM_TEMPERATURE_MODEL_SUBSTRINGS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const s of subStrs) {
    if (s && mid.includes(s)) return true;
  }

  const prov = routingProvider.trim().toLowerCase();
  const disableDeploy =
    (env.INGEST_DISABLE_OPENAI_DEPLOYMENT_TEMPERATURE_OMIT ?? "").trim() === "1";
  if (!disableDeploy && prov === "openai" && /\/deployments\//i.test(mid)) {
    return true;
  }

  if ((prov === "vertex" || prov === "google") && /\bgemini-3/i.test(mid)) {
    return true;
  }

  return false;
}

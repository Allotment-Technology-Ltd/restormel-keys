import type {
  AcceptanceCriterionDefinition,
  AcSequenceBuiltInAgent,
  AcSequenceConfig,
  AcSequencePostCheck,
  AfterAgentPhase,
  ArtifactPolicy,
  EnvironmentProfile,
  ExecutionMode,
  GoalType,
  JudgeRubric,
  MissionConstraints,
  RetryPolicy,
  StructuredCheck,
  SuccessCriteria,
  TestGoal,
  TestSuite,
} from "@restormel/testing-core";
import { isOpaqueKeyRef, isSafeHttpUrl, looksLikeInlineSecret } from "./refs.js";
import { isPlainObject, pickKey } from "./pick.js";
import type { ConfigDefaults, ConfigError, RestormelTestingConfig, SupportedSchemaVersion } from "./schema.js";
import { SUPPORTED_SCHEMA_VERSIONS } from "./schema.js";

const ROOT_KEYS = new Set([
  "schema_version",
  "schemaVersion",
  "keys",
  "defaults",
  "environments",
  "suites",
  "adapter_hooks",
  "adapterHooks",
  "target_url_overrides",
  "targetUrlOverrides",
]);

function err(path: string, code: string, message: string): ConfigError {
  return { path, code, message };
}

function asString(value: unknown, path: string, label: string, errors: ConfigError[]): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    errors.push(err(path, "type", `${label} must be a string`));
    return undefined;
  }
  if (value.trim() === "") {
    errors.push(err(path, "empty", `${label} must be non-empty`));
    return undefined;
  }
  return value;
}

function asNonNegInt(value: unknown, path: string, label: string, errors: ConfigError[]): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    errors.push(err(path, "range", `${label} must be a non-negative integer`));
    return undefined;
  }
  return value;
}

function asPosInt(value: unknown, path: string, label: string, errors: ConfigError[]): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    errors.push(err(path, "range", `${label} must be a positive integer`));
    return undefined;
  }
  return value;
}

function parseKeysMap(
  raw: unknown,
  path: string,
  errors: ConfigError[],
): Record<string, string> {
  if (raw === undefined || raw === null) return {};
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "keys must be an object of string → ref"));
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const p = `${path}.${k}`;
    const s = asString(v, p, `keys.${k}`, errors);
    if (s === undefined) continue;
    if (looksLikeInlineSecret(s)) {
      errors.push(err(p, "unsafe", "Value looks like an inline secret; use ref:restormel-keys:… or env:VAR"));
      continue;
    }
    if (!isOpaqueKeyRef(s)) {
      errors.push(
        err(
          p,
          "ref_format",
          `Keys slot must be ref:restormel-keys:… or env:UPPER_SNAKE (got non-matching format)`,
        ),
      );
      continue;
    }
    out[k] = s;
  }
  return out;
}

function parseRetryPolicy(raw: unknown, path: string, errors: ConfigError[]): RetryPolicy | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "retry_policy must be an object"));
    return undefined;
  }
  const maxRaw = pickKey(raw, "max_retries", "maxRetries");
  const max = asNonNegInt(maxRaw, `${path}.max_retries`, "max_retries", errors);
  if (max === undefined) {
    errors.push(err(`${path}.max_retries`, "required", "retry_policy.max_retries is required"));
    return undefined;
  }
  const backoffRaw = pickKey(raw, "backoff_ms", "backoffMs");
  const backoffMs = asNonNegInt(backoffRaw, `${path}.backoff_ms`, "backoff_ms", errors);
  const policy: RetryPolicy = { maxRetries: max };
  if (backoffMs !== undefined) policy.backoffMs = backoffMs;
  return policy;
}

const ARTIFACT_KINDS: readonly string[] = ["never", "on_failure", "always"];

function parseArtifactPolicy(raw: unknown, path: string, errors: ConfigError[]): ArtifactPolicy | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "artifact_policy must be an object"));
    return undefined;
  }
  const shots = asString(
    pickKey(raw, "screenshots", "screenshots"),
    `${path}.screenshots`,
    "screenshots",
    errors,
  );
  const trace = asString(
    pickKey(raw, "browser_trace", "browserTrace"),
    `${path}.browser_trace`,
    "browser_trace",
    errors,
  );
  const consoleRaw = pickKey(raw, "console", "console");
  if (typeof consoleRaw !== "boolean") {
    errors.push(err(`${path}.console`, "type", "artifact_policy.console must be a boolean"));
    return undefined;
  }
  if (!shots || !trace) return undefined;
  if (!ARTIFACT_KINDS.includes(shots)) {
    errors.push(
      err(
        `${path}.screenshots`,
        "enum",
        `screenshots must be one of: never, on_failure, always (got ${JSON.stringify(shots)})`,
      ),
    );
    return undefined;
  }
  if (!ARTIFACT_KINDS.includes(trace)) {
    errors.push(
      err(
        `${path}.browser_trace`,
        "enum",
        `browser_trace must be one of: never, on_failure, always (got ${JSON.stringify(trace)})`,
      ),
    );
    return undefined;
  }
  return {
    screenshots: shots as ArtifactPolicy["screenshots"],
    browserTrace: trace as ArtifactPolicy["browserTrace"],
    console: consoleRaw,
  };
}

function parseDefaults(raw: unknown, path: string, errors: ConfigError[]): ConfigDefaults | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "defaults must be an object"));
    return undefined;
  }
  const retryPolicy = parseRetryPolicy(pickKey(raw, "retry_policy", "retryPolicy"), `${path}.retry_policy`, errors);
  const defaultTimeoutMs = asPosInt(
    pickKey(raw, "default_timeout_ms", "defaultTimeoutMs"),
    `${path}.default_timeout_ms`,
    "default_timeout_ms",
    errors,
  );
  const artifactPolicy = parseArtifactPolicy(
    pickKey(raw, "artifact_policy", "artifactPolicy"),
    `${path}.artifact_policy`,
    errors,
  );
  const d: ConfigDefaults = {};
  if (retryPolicy) d.retryPolicy = retryPolicy;
  if (defaultTimeoutMs !== undefined) d.defaultTimeoutMs = defaultTimeoutMs;
  if (artifactPolicy) d.artifactPolicy = artifactPolicy;
  return Object.keys(d).length > 0 ? d : undefined;
}

function parseEnvironment(
  id: string,
  raw: unknown,
  path: string,
  errors: ConfigError[],
): EnvironmentProfile | undefined {
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", `Environment "${id}" must be an object`));
    return undefined;
  }
  const baseUrlRaw = pickKey(raw, "base_url", "baseUrl");
  const baseUrl = asString(baseUrlRaw, `${path}.base_url`, "base_url", errors);
  if (!baseUrl) return undefined;
  const urlCheck = isSafeHttpUrl(baseUrl);
  if (!urlCheck.ok) {
    errors.push(err(`${path}.base_url`, "url", urlCheck.reason));
    return undefined;
  }
  const authModeRaw = pickKey(raw, "auth_mode", "authMode");
  let authMode: EnvironmentProfile["authMode"];
  if (authModeRaw === undefined || authModeRaw === null) {
    authMode = undefined;
  } else if (authModeRaw === "none" || authModeRaw === "cookie_jar" || authModeRaw === "storage_state") {
    authMode = authModeRaw;
  } else {
    errors.push(
      err(
        `${path}.auth_mode`,
        "enum",
        `auth_mode must be none, cookie_jar, or storage_state (got ${JSON.stringify(authModeRaw)})`,
      ),
    );
    return undefined;
  }
  const authRefRaw = pickKey(raw, "auth_ref", "authRef");
  const authRef =
    authRefRaw === undefined || authRefRaw === null
      ? undefined
      : asString(authRefRaw, `${path}.auth_ref`, "auth_ref", errors);
  if (authRef && looksLikeInlineSecret(authRef)) {
    errors.push(err(`${path}.auth_ref`, "unsafe", "auth_ref must be an opaque ref (env:VAR or path token), not a secret"));
    return undefined;
  }
  const keys = parseKeysMap(pickKey(raw, "keys", "keys"), `${path}.keys`, errors);
  const profile: EnvironmentProfile = { id, baseUrl, keys: Object.keys(keys).length ? keys : undefined };
  if (authMode !== undefined) profile.authMode = authMode;
  if (authRef !== undefined) profile.authRef = authRef;
  return profile;
}

function parseStructuredCheck(raw: unknown, path: string, errors: ConfigError[]): StructuredCheck | undefined {
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "structured_check must be an object"));
    return undefined;
  }
  const pathVal = asString(pickKey(raw, "path", "path"), `${path}.path`, "path", errors);
  if (!pathVal) return undefined;
  const id = pickKey(raw, "id", "id");
  const check: StructuredCheck = { path: pathVal };
  if (id !== undefined && id !== null) {
    const sid = asString(id, `${path}.id`, "id", errors);
    if (sid) check.id = sid;
  }
  if (Object.prototype.hasOwnProperty.call(raw, "expect")) {
    check.expect = raw.expect;
  }
  return check;
}

function parseJudgeRubric(raw: unknown, path: string, errors: ConfigError[]): JudgeRubric | undefined {
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "judge_rubric must be an object"));
    return undefined;
  }
  const id = asString(pickKey(raw, "id", "id"), `${path}.id`, "id", errors);
  if (!id) return undefined;
  const rubric: JudgeRubric = { id };
  const modelRef = pickKey(raw, "model_ref", "modelRef");
  if (modelRef !== undefined && modelRef !== null) {
    const m = asString(modelRef, `${path}.model_ref`, "model_ref", errors);
    if (m) rubric.modelRef = m;
  }
  const summary = pickKey(raw, "summary", "summary");
  if (summary !== undefined && summary !== null) {
    const s = asString(summary, `${path}.summary`, "summary", errors);
    if (s) rubric.summary = s;
  }
  const ctxSel = pickKey(raw, "context_selector", "contextSelector");
  if (ctxSel !== undefined && ctxSel !== null) {
    const cs = asString(ctxSel, `${path}.context_selector`, "context_selector", errors);
    if (cs) rubric.contextSelector = cs;
  }
  return rubric;
}

function parseMissionConstraints(raw: unknown, path: string, errors: ConfigError[]): MissionConstraints | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "mission_constraints must be an object"));
    return undefined;
  }
  const out: MissionConstraints = {};
  const maxDur = pickKey(raw, "max_duration_ms", "maxDurationMs");
  if (maxDur !== undefined && maxDur !== null) {
    const n = asPosInt(maxDur, `${path}.max_duration_ms`, "max_duration_ms", errors);
    if (n !== undefined) out.maxDurationMs = n;
  }
  const ua = pickKey(raw, "url_allowlist", "urlAllowlist");
  if (ua !== undefined && ua !== null) {
    if (!Array.isArray(ua) || !ua.every((x) => typeof x === "string")) {
      errors.push(err(`${path}.url_allowlist`, "type", "url_allowlist must be string[]"));
      return undefined;
    }
    out.urlAllowlist = ua as string[];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseAfterAgent(raw: unknown, path: string, errors: ConfigError[]): AfterAgentPhase | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "after_agent must be an object"));
    return undefined;
  }
  const out: AfterAgentPhase = {};
  const sp = pickKey(raw, "start_path", "startPath");
  if (sp !== undefined && sp !== null) {
    const s = asString(sp, `${path}.start_path`, "start_path", errors);
    if (s) {
      if (s.includes("..")) {
        errors.push(err(`${path}.start_path`, "unsafe", "start_path must not contain '..'"));
      } else {
        out.startPath = s;
      }
    }
  }
  const scr = pickKey(raw, "success_criteria", "successCriteria");
  if (scr !== undefined && scr !== null) {
    const sc = parseSuccessCriteria(scr, `${path}.success_criteria`, errors);
    if (sc) out.successCriteria = sc;
  }
  if (out.startPath === undefined && out.successCriteria === undefined) {
    errors.push(err(path, "empty", "after_agent must include start_path and/or success_criteria"));
    return undefined;
  }
  return out;
}

function parseSuccessCriteria(
  raw: unknown,
  path: string,
  errors: ConfigError[],
  opts?: { allowEmpty?: boolean },
): SuccessCriteria | undefined {
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "success_criteria must be an object"));
    return undefined;
  }
  const anyOfRaw = pickKey(raw, "any_of", "anyOf");
  if (anyOfRaw !== undefined && anyOfRaw !== null) {
    const otherKeys = Object.keys(raw).filter((k) => k !== "any_of" && k !== "anyOf");
    if (otherKeys.length > 0) {
      errors.push(
        err(
          path,
          "any_of_exclusive",
          `When any_of is set, no other success_criteria keys are allowed at the same level (found: ${otherKeys.join(", ")})`,
        ),
      );
      return undefined;
    }
    if (!Array.isArray(anyOfRaw) || anyOfRaw.length < 2) {
      errors.push(
        err(`${path}.any_of`, "any_of_length", "any_of must be an array with at least two alternative criteria objects"),
      );
      return undefined;
    }
    const branches: SuccessCriteria[] = [];
    for (let i = 0; i < anyOfRaw.length; i++) {
      const b = parseSuccessCriteria(anyOfRaw[i], `${path}.any_of[${i}]`, errors);
      if (!b) return undefined;
      branches.push(b);
    }
    return { anyOf: branches };
  }

  const out: SuccessCriteria = {};
  const urlMatches = pickKey(raw, "url_matches", "urlMatches");
  if (urlMatches !== undefined && urlMatches !== null) {
    if (typeof urlMatches === "string") {
      out.urlMatches = urlMatches;
    } else if (Array.isArray(urlMatches) && urlMatches.every((x) => typeof x === "string")) {
      out.urlMatches = urlMatches as string[];
    } else {
      errors.push(err(`${path}.url_matches`, "type", "url_matches must be a string or string[]"));
      return undefined;
    }
  }
  const dom = pickKey(raw, "dom_signals", "domSignals");
  if (dom !== undefined && dom !== null) {
    if (!Array.isArray(dom) || !dom.every((x) => typeof x === "string")) {
      errors.push(err(`${path}.dom_signals`, "type", "dom_signals must be string[]"));
      return undefined;
    }
    out.domSignals = dom as string[];
  }
  const tp = pickKey(raw, "text_present", "textPresent");
  if (tp !== undefined && tp !== null) {
    if (!Array.isArray(tp) || !tp.every((x) => typeof x === "string")) {
      errors.push(err(`${path}.text_present`, "type", "text_present must be string[]"));
      return undefined;
    }
    out.textPresent = tp as string[];
  }
  const ta = pickKey(raw, "text_absent", "textAbsent");
  if (ta !== undefined && ta !== null) {
    if (!Array.isArray(ta) || !ta.every((x) => typeof x === "string")) {
      errors.push(err(`${path}.text_absent`, "type", "text_absent must be string[]"));
      return undefined;
    }
    out.textAbsent = ta as string[];
  }
  const sc = pickKey(raw, "structured_checks", "structuredChecks");
  if (sc !== undefined && sc !== null) {
    if (!Array.isArray(sc)) {
      errors.push(err(`${path}.structured_checks`, "type", "structured_checks must be an array"));
      return undefined;
    }
    const checks: StructuredCheck[] = [];
    sc.forEach((item, i) => {
      const c = parseStructuredCheck(item, `${path}.structured_checks[${i}]`, errors);
      if (c) checks.push(c);
    });
    if (checks.length) out.structuredChecks = checks;
  }
  const jr = pickKey(raw, "judge_rubric", "judgeRubric");
  if (jr !== undefined && jr !== null) {
    const rubric = parseJudgeRubric(jr, `${path}.judge_rubric`, errors);
    if (rubric) out.judgeRubric = rubric;
  }

  const hasAny =
    out.urlMatches != null ||
    (out.domSignals != null && out.domSignals.length > 0) ||
    (out.textPresent != null && out.textPresent.length > 0) ||
    (out.textAbsent != null && out.textAbsent.length > 0) ||
    (out.structuredChecks != null && out.structuredChecks.length > 0) ||
    out.judgeRubric != null;

  if (!hasAny) {
    if (opts?.allowEmpty) {
      return {};
    }
    errors.push(
      err(
        path,
        "success_criteria_empty",
        "success_criteria must include at least one of: any_of, url_matches, dom_signals, text_present, text_absent, structured_checks, judge_rubric",
      ),
    );
    return undefined;
  }
  return out;
}

function parseAcSequencePostCheck(
  raw: unknown,
  path: string,
  errors: ConfigError[],
  allowedAcIds: Set<string>,
): AcSequencePostCheck | undefined {
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "post_checks entry must be an object"));
    return undefined;
  }
  const acId = asString(pickKey(raw, "ac_id", "acId"), `${path}.ac_id`, "ac_id", errors);
  if (!acId) return undefined;
  if (!allowedAcIds.has(acId)) {
    errors.push(
      err(`${path}.ac_id`, "unknown_ac_id", `post_checks ac_id "${acId}" is not a suite acceptance_criteria id`),
    );
    return undefined;
  }

  let http: AcSequencePostCheck["http"];
  const httpRaw = pickKey(raw, "http", "http");
  if (httpRaw !== undefined && httpRaw !== null) {
    if (!isPlainObject(httpRaw)) {
      errors.push(err(`${path}.http`, "type", "post_checks.http must be an object"));
      return undefined;
    }
    const url = asString(pickKey(httpRaw, "url", "url"), `${path}.http.url`, "url", errors);
    if (!url) return undefined;
    http = { url };
    const method = pickKey(httpRaw, "method", "method");
    if (method !== undefined && method !== null) {
      if (typeof method !== "string") {
        errors.push(err(`${path}.http.method`, "type", "method must be a string"));
        return undefined;
      }
      http.method = method;
    }
    const expectStatus = pickKey(httpRaw, "expect_status", "expectStatus");
    if (expectStatus !== undefined && expectStatus !== null) {
      if (!Array.isArray(expectStatus) || !expectStatus.every((x) => typeof x === "number" && Number.isInteger(x))) {
        errors.push(err(`${path}.http.expect_status`, "type", "expect_status must be number[]"));
        return undefined;
      }
      http.expectStatus = expectStatus as number[];
    }
    const headers = pickKey(httpRaw, "headers", "headers");
    if (headers !== undefined && headers !== null) {
      if (!isPlainObject(headers)) {
        errors.push(err(`${path}.http.headers`, "type", "headers must be an object"));
        return undefined;
      }
      const h: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v !== "string") {
          errors.push(err(`${path}.http.headers`, "type", "headers values must be strings"));
          return undefined;
        }
        h[k] = v;
      }
      http.headers = h;
    }
    const body = pickKey(httpRaw, "body", "body");
    if (body !== undefined && body !== null) {
      if (typeof body !== "string") {
        errors.push(err(`${path}.http.body`, "type", "body must be a string"));
        return undefined;
      }
      http.body = body;
    }
  }

  let domRoleName: AcSequencePostCheck["domRoleName"];
  const domRaw = pickKey(raw, "dom_role_name", "domRoleName");
  if (domRaw !== undefined && domRaw !== null) {
    if (!isPlainObject(domRaw)) {
      errors.push(err(`${path}.dom_role_name`, "type", "dom_role_name must be an object"));
      return undefined;
    }
    const role = asString(pickKey(domRaw, "role", "role"), `${path}.dom_role_name.role`, "role", errors);
    if (!role) return undefined;
    domRoleName = { role };
    const name = pickKey(domRaw, "name", "name");
    if (name !== undefined && name !== null) {
      if (typeof name !== "string") {
        errors.push(err(`${path}.dom_role_name.name`, "type", "name must be a string"));
        return undefined;
      }
      domRoleName.name = name;
    }
    const ev = pickKey(domRaw, "expect_visible", "expectVisible");
    if (ev !== undefined && ev !== null) {
      if (typeof ev !== "boolean") {
        errors.push(err(`${path}.dom_role_name.expect_visible`, "type", "expect_visible must be a boolean"));
        return undefined;
      }
      domRoleName.expectVisible = ev;
    }
  }

  let dbShell: string | undefined;
  const dbs = pickKey(raw, "db_shell", "dbShell");
  if (dbs !== undefined && dbs !== null) {
    if (typeof dbs !== "string") {
      errors.push(err(`${path}.db_shell`, "type", "db_shell must be a string"));
      return undefined;
    }
    const t = dbs.trim();
    if (t.length > 0) dbShell = t;
  }

  if (http === undefined && domRoleName === undefined && dbShell === undefined) {
    errors.push(
      err(
        path,
        "post_check_empty",
        "post_checks entry must include at least one of: http, dom_role_name, db_shell",
      ),
    );
    return undefined;
  }

  const out: AcSequencePostCheck = { acId };
  if (http !== undefined) out.http = http;
  if (domRoleName !== undefined) out.domRoleName = domRoleName;
  if (dbShell !== undefined) out.dbShell = dbShell;
  return out;
}

function parseAcSequence(
  raw: unknown,
  path: string,
  errors: ConfigError[],
  allowedAcIds: Set<string>,
): AcSequenceConfig | undefined {
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "ac_sequence must be an object"));
    return undefined;
  }
  const agentRaw = pickKey(raw, "built_in_agent", "builtInAgent");
  if (agentRaw === undefined || agentRaw === null || !isPlainObject(agentRaw)) {
    errors.push(err(`${path}.built_in_agent`, "required", "ac_sequence.built_in_agent is required"));
    return undefined;
  }
  const builtInAgent: AcSequenceBuiltInAgent = {};
  const mr = pickKey(agentRaw, "model_ref", "modelRef");
  if (mr !== undefined && mr !== null) {
    const s = asString(mr, `${path}.built_in_agent.model_ref`, "model_ref", errors);
    if (s) builtInAgent.modelRef = s;
  }
  const maxRounds = asNonNegInt(
    pickKey(agentRaw, "max_rounds_per_criterion", "maxRoundsPerCriterion"),
    `${path}.built_in_agent.max_rounds_per_criterion`,
    "max_rounds_per_criterion",
    errors,
  );
  if (maxRounds !== undefined) builtInAgent.maxRoundsPerCriterion = maxRounds;
  const instr = pickKey(agentRaw, "instructions", "instructions");
  if (instr !== undefined && instr !== null) {
    if (typeof instr !== "string") {
      errors.push(err(`${path}.built_in_agent.instructions`, "type", "instructions must be a string"));
      return undefined;
    }
    if (instr.trim() !== "") builtInAgent.instructions = instr;
  }

  let criterionExecutor: string | undefined;
  const ceRaw = pickKey(raw, "criterion_executor", "criterionExecutor");
  if (ceRaw !== undefined && ceRaw !== null) {
    const s = asString(ceRaw, `${path}.criterion_executor`, "criterion_executor", errors);
    if (!s) return undefined;
    criterionExecutor = s;
  }
  let criterionSuccess: AcSequenceConfig["criterionSuccess"];
  const csRaw = pickKey(raw, "criterion_success", "criterionSuccess");
  if (csRaw !== undefined && csRaw !== null) {
    if (!isPlainObject(csRaw)) {
      errors.push(err(`${path}.criterion_success`, "type", "criterion_success must be an object"));
      return undefined;
    }
    criterionSuccess = {};
    for (const [k, v] of Object.entries(csRaw)) {
      if (!allowedAcIds.has(k)) {
        errors.push(
          err(
            `${path}.criterion_success`,
            "unknown_ac_id",
            `criterion_success key "${k}" is not a suite acceptance_criteria id`,
          ),
        );
        return undefined;
      }
      const sc = parseSuccessCriteria(v, `${path}.criterion_success.${k}`, errors);
      if (!sc) return undefined;
      criterionSuccess[k] = sc;
    }
  }

  let criterionRubrics: AcSequenceConfig["criterionRubrics"];
  const crRaw = pickKey(raw, "criterion_rubrics", "criterionRubrics");
  if (crRaw !== undefined && crRaw !== null) {
    if (!isPlainObject(crRaw)) {
      errors.push(err(`${path}.criterion_rubrics`, "type", "criterion_rubrics must be an object"));
      return undefined;
    }
    criterionRubrics = {};
    for (const [k, v] of Object.entries(crRaw)) {
      if (!allowedAcIds.has(k)) {
        errors.push(
          err(
            `${path}.criterion_rubrics`,
            "unknown_ac_id",
            `criterion_rubrics key "${k}" is not a suite acceptance_criteria id`,
          ),
        );
        return undefined;
      }
      const rub = parseJudgeRubric(v, `${path}.criterion_rubrics.${k}`, errors);
      if (!rub) return undefined;
      criterionRubrics[k] = rub;
    }
  }

  let postChecks: AcSequencePostCheck[] | undefined;
  const pcRaw = pickKey(raw, "post_checks", "postChecks");
  if (pcRaw !== undefined && pcRaw !== null) {
    if (!Array.isArray(pcRaw)) {
      errors.push(err(`${path}.post_checks`, "type", "post_checks must be an array"));
      return undefined;
    }
    const list: AcSequencePostCheck[] = [];
    for (let i = 0; i < pcRaw.length; i++) {
      const p = parseAcSequencePostCheck(pcRaw[i], `${path}.post_checks[${i}]`, errors, allowedAcIds);
      if (!p) return undefined;
      list.push(p);
    }
    postChecks = list;
  }

  const out: AcSequenceConfig = { builtInAgent };
  if (criterionExecutor !== undefined) out.criterionExecutor = criterionExecutor;
  if (criterionSuccess) out.criterionSuccess = criterionSuccess;
  if (criterionRubrics) out.criterionRubrics = criterionRubrics;
  if (postChecks) out.postChecks = postChecks;
  return out;
}

function parseSuiteAcceptanceCriteria(
  raw: unknown,
  path: string,
  errors: ConfigError[],
): { list: AcceptanceCriterionDefinition[]; idSet: Set<string> } | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    errors.push(err(path, "type", "acceptance_criteria must be an array of { id, text }"));
    return undefined;
  }
  if (raw.length === 0) {
    errors.push(err(path, "empty", "acceptance_criteria must not be an empty array"));
    return undefined;
  }
  const list: AcceptanceCriterionDefinition[] = [];
  const idSet = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isPlainObject(item)) {
      errors.push(err(`${path}[${i}]`, "type", "each acceptance_criteria entry must be an object"));
      return undefined;
    }
    const cid = asString(pickKey(item, "id", "id"), `${path}[${i}].id`, "id", errors);
    const text = asString(pickKey(item, "text", "text"), `${path}[${i}].text`, "text", errors);
    if (!cid || !text) return undefined;
    if (idSet.has(cid)) {
      errors.push(err(`${path}[${i}].id`, "duplicate", `Duplicate acceptance criterion id "${cid}"`));
      return undefined;
    }
    idSet.add(cid);
    list.push({ id: cid, text });
  }
  return { list, idSet };
}

/** Returns false if validation errors were added for this field. */
function addOptionalAcceptanceCriterionIds(
  goal: TestGoal,
  raw: Record<string, unknown>,
  path: string,
  errors: ConfigError[],
  allowedAcIds: Set<string> | undefined,
): boolean {
  const acRaw = pickKey(raw, "acceptance_criterion_ids", "acceptanceCriterionIds");
  if (acRaw === undefined || acRaw === null) return true;
  if (!Array.isArray(acRaw) || !acRaw.every((x) => typeof x === "string")) {
    errors.push(err(`${path}.acceptance_criterion_ids`, "type", "acceptance_criterion_ids must be string[]"));
    return false;
  }
  const ids = (acRaw as string[]).map((s) => s.trim()).filter((s) => s.length > 0);
  if (ids.length === 0) return true;
  if (allowedAcIds === undefined) {
    errors.push(
      err(
        `${path}.acceptance_criterion_ids`,
        "requires_suite_ac",
        "acceptance_criterion_ids requires suite-level acceptance_criteria",
      ),
    );
    return false;
  }
  for (let i = 0; i < ids.length; i++) {
    const cid = ids[i]!;
    if (!allowedAcIds.has(cid)) {
      errors.push(
        err(
          `${path}.acceptance_criterion_ids`,
          "unknown_ac_id",
          `Unknown acceptance criterion id "${cid}" (not in suite acceptance_criteria)`,
        ),
      );
      return false;
    }
  }
  goal.acceptanceCriterionIds = ids;
  return true;
}

function parseGoal(
  raw: unknown,
  path: string,
  errors: ConfigError[],
  allowedAcIds: Set<string> | undefined,
  orderedAcIds: string[],
): TestGoal | undefined {
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", "goal must be an object"));
    return undefined;
  }
  const id = asString(pickKey(raw, "id", "id"), `${path}.id`, "id", errors);
  const description = asString(pickKey(raw, "description", "description"), `${path}.description`, "description", errors);
  const typeRaw = pickKey(raw, "type", "type");
  if (typeof typeRaw !== "string" || !["browser", "performance", "native"].includes(typeRaw)) {
    errors.push(
      err(
        `${path}.type`,
        "enum",
        `type must be browser, performance, or native (got ${JSON.stringify(typeRaw)})`,
      ),
    );
    return undefined;
  }
  const type = typeRaw as GoalType;

  const emRaw = pickKey(raw, "execution_mode", "executionMode");
  let executionMode: ExecutionMode = "observe";
  if (emRaw !== undefined && emRaw !== null) {
    if (emRaw !== "observe" && emRaw !== "agent" && emRaw !== "ac_sequence") {
      errors.push(
        err(
          `${path}.execution_mode`,
          "enum",
          `execution_mode must be observe, agent, or ac_sequence (got ${JSON.stringify(emRaw)})`,
        ),
      );
      return undefined;
    }
    executionMode = emRaw as ExecutionMode;
  }

  const acSeqKey = pickKey(raw, "ac_sequence", "acSequence");
  if (acSeqKey != null && executionMode !== "ac_sequence") {
    errors.push(
      err(
        `${path}.ac_sequence`,
        "forbidden",
        "ac_sequence is only allowed when execution_mode is ac_sequence",
      ),
    );
    return undefined;
  }

  const missionRaw = pickKey(raw, "mission", "mission");
  const missionExecRaw = pickKey(raw, "mission_executor", "missionExecutor");
  const missionConstraintsRaw = pickKey(raw, "mission_constraints", "missionConstraints");

  if (executionMode === "agent") {
    if (type !== "browser") {
      errors.push(
        err(`${path}.execution_mode`, "agent_browser_only", "execution_mode: agent is only valid for type: browser"),
      );
      return undefined;
    }
    const afterAgentKey = pickKey(raw, "after_agent", "afterAgent");
    let afterAgent: AfterAgentPhase | undefined;
    if (afterAgentKey !== undefined && afterAgentKey !== null) {
      afterAgent = parseAfterAgent(afterAgentKey, `${path}.after_agent`, errors);
      if (!afterAgent) return undefined;
    }
    const mission = asString(missionRaw, `${path}.mission`, "mission", errors);
    const missionExecutor = asString(missionExecRaw, `${path}.mission_executor`, "mission_executor", errors);
    if (!mission || !missionExecutor) return undefined;
    const missionConstraints = parseMissionConstraints(
      missionConstraintsRaw,
      `${path}.mission_constraints`,
      errors,
    );
    if (missionConstraintsRaw != null && missionConstraints === undefined) return undefined;

    const scRaw = pickKey(raw, "success_criteria", "successCriteria");
    let successCriteria: SuccessCriteria | undefined;
    if (afterAgent?.successCriteria) {
      successCriteria = afterAgent.successCriteria;
    } else {
      successCriteria = parseSuccessCriteria(scRaw, `${path}.success_criteria`, errors);
    }
    if (!id || !description || !successCriteria) return undefined;

    const goal: TestGoal = {
      id,
      type,
      description,
      successCriteria,
      executionMode: "agent",
      mission,
      missionExecutor,
    };
    if (missionConstraints) goal.missionConstraints = missionConstraints;
    if (afterAgent?.startPath !== undefined) {
      goal.afterAgent = { startPath: afterAgent.startPath };
    }
    const startPathRaw = pickKey(raw, "start_path", "startPath");
    if (startPathRaw !== undefined && startPathRaw !== null) {
      const sp = asString(startPathRaw, `${path}.start_path`, "start_path", errors);
      if (sp) {
        if (sp.includes("..")) {
          errors.push(err(`${path}.start_path`, "unsafe", "start_path must not contain '..'"));
        } else {
          goal.startPath = sp;
        }
      }
    }
    const pre = pickKey(raw, "preconditions", "preconditions");
    if (pre !== undefined && pre !== null) {
      if (!Array.isArray(pre) || !pre.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.preconditions`, "type", "preconditions must be string[]"));
        return undefined;
      }
      goal.preconditions = pre as string[];
    }
    const clean = pickKey(raw, "cleanup", "cleanup");
    if (clean !== undefined && clean !== null) {
      if (!Array.isArray(clean) || !clean.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.cleanup`, "type", "cleanup must be string[]"));
        return undefined;
      }
      goal.cleanup = clean as string[];
    }
    const ex = pickKey(raw, "exclusive_with", "exclusiveWith");
    if (ex !== undefined && ex !== null) {
      if (!Array.isArray(ex) || !ex.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.exclusive_with`, "type", "exclusive_with must be string[]"));
        return undefined;
      }
      goal.exclusiveWith = ex as string[];
    }
    const tags = pickKey(raw, "tags", "tags");
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags) || !tags.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.tags`, "type", "tags must be string[]"));
        return undefined;
      }
      goal.tags = tags as string[];
    }
    if (!addOptionalAcceptanceCriterionIds(goal, raw, path, errors, allowedAcIds)) return undefined;
    return goal;
  }

  if (executionMode === "ac_sequence") {
    if (type !== "browser") {
      errors.push(
        err(
          `${path}.execution_mode`,
          "ac_sequence_browser_only",
          "execution_mode: ac_sequence is only valid for type: browser",
        ),
      );
      return undefined;
    }
    if (!allowedAcIds || orderedAcIds.length === 0) {
      errors.push(
        err(
          `${path}.execution_mode`,
          "requires_suite_ac",
          "execution_mode: ac_sequence requires suite-level acceptance_criteria",
        ),
      );
      return undefined;
    }
    if (acSeqKey === undefined || acSeqKey === null) {
      errors.push(
        err(`${path}.ac_sequence`, "required", "execution_mode: ac_sequence requires an ac_sequence block"),
      );
      return undefined;
    }
    const acSequence = parseAcSequence(acSeqKey, `${path}.ac_sequence`, errors, allowedAcIds);
    if (!acSequence) return undefined;

    const scRawAc = pickKey(raw, "success_criteria", "successCriteria");
    let successCriteriaAc: SuccessCriteria;
    if (scRawAc === undefined || scRawAc === null) {
      successCriteriaAc = {};
    } else {
      const p = parseSuccessCriteria(scRawAc, `${path}.success_criteria`, errors, { allowEmpty: true });
      if (!p) return undefined;
      successCriteriaAc = p;
    }

    if (!id || !description) return undefined;

    const goalAc: TestGoal = {
      id,
      type,
      description,
      successCriteria: successCriteriaAc,
      executionMode: "ac_sequence",
      acSequence,
    };
    const startPathRawAc = pickKey(raw, "start_path", "startPath");
    if (startPathRawAc !== undefined && startPathRawAc !== null) {
      const sp = asString(startPathRawAc, `${path}.start_path`, "start_path", errors);
      if (sp) {
        if (sp.includes("..")) {
          errors.push(err(`${path}.start_path`, "unsafe", "start_path must not contain '..'"));
        } else {
          goalAc.startPath = sp;
        }
      }
    }
    const preAc = pickKey(raw, "preconditions", "preconditions");
    if (preAc !== undefined && preAc !== null) {
      if (!Array.isArray(preAc) || !preAc.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.preconditions`, "type", "preconditions must be string[]"));
        return undefined;
      }
      goalAc.preconditions = preAc as string[];
    }
    const cleanAc = pickKey(raw, "cleanup", "cleanup");
    if (cleanAc !== undefined && cleanAc !== null) {
      if (!Array.isArray(cleanAc) || !cleanAc.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.cleanup`, "type", "cleanup must be string[]"));
        return undefined;
      }
      goalAc.cleanup = cleanAc as string[];
    }
    const exAc = pickKey(raw, "exclusive_with", "exclusiveWith");
    if (exAc !== undefined && exAc !== null) {
      if (!Array.isArray(exAc) || !exAc.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.exclusive_with`, "type", "exclusive_with must be string[]"));
        return undefined;
      }
      goalAc.exclusiveWith = exAc as string[];
    }
    const tagsAc = pickKey(raw, "tags", "tags");
    if (tagsAc !== undefined && tagsAc !== null) {
      if (!Array.isArray(tagsAc) || !tagsAc.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.tags`, "type", "tags must be string[]"));
        return undefined;
      }
      goalAc.tags = tagsAc as string[];
    }
    if (!addOptionalAcceptanceCriterionIds(goalAc, raw, path, errors, allowedAcIds)) return undefined;
    if (goalAc.acceptanceCriterionIds === undefined || goalAc.acceptanceCriterionIds.length === 0) {
      goalAc.acceptanceCriterionIds = [...orderedAcIds];
    }
    return goalAc;
  }

  if (missionRaw != null || missionExecRaw != null || missionConstraintsRaw != null) {
    errors.push(
      err(
        `${path}.mission`,
        "forbidden",
        "mission, mission_executor, and mission_constraints are only allowed when execution_mode is agent",
      ),
    );
    return undefined;
  }
  if (pickKey(raw, "after_agent", "afterAgent") != null) {
    errors.push(
      err(
        `${path}.after_agent`,
        "forbidden",
        "after_agent is only allowed when execution_mode is agent",
      ),
    );
    return undefined;
  }

  const scRaw = pickKey(raw, "success_criteria", "successCriteria");
  const successCriteria = parseSuccessCriteria(scRaw, `${path}.success_criteria`, errors);
  if (!id || !description || !successCriteria) return undefined;

  const goal: TestGoal = { id, type, description, successCriteria };
  const startPathRaw = pickKey(raw, "start_path", "startPath");
  if (startPathRaw !== undefined && startPathRaw !== null) {
    const sp = asString(startPathRaw, `${path}.start_path`, "start_path", errors);
    if (sp) {
      if (sp.includes("..")) {
        errors.push(err(`${path}.start_path`, "unsafe", "start_path must not contain '..'"));
      } else {
        goal.startPath = sp;
      }
    }
  }
  const pre = pickKey(raw, "preconditions", "preconditions");
  if (pre !== undefined && pre !== null) {
    if (!Array.isArray(pre) || !pre.every((x) => typeof x === "string")) {
      errors.push(err(`${path}.preconditions`, "type", "preconditions must be string[]"));
      return undefined;
    }
    goal.preconditions = pre as string[];
  }
  const clean = pickKey(raw, "cleanup", "cleanup");
  if (clean !== undefined && clean !== null) {
    if (!Array.isArray(clean) || !clean.every((x) => typeof x === "string")) {
      errors.push(err(`${path}.cleanup`, "type", "cleanup must be string[]"));
      return undefined;
    }
    goal.cleanup = clean as string[];
  }
  const ex = pickKey(raw, "exclusive_with", "exclusiveWith");
  if (ex !== undefined && ex !== null) {
    if (!Array.isArray(ex) || !ex.every((x) => typeof x === "string")) {
      errors.push(err(`${path}.exclusive_with`, "type", "exclusive_with must be string[]"));
      return undefined;
    }
    goal.exclusiveWith = ex as string[];
  }
    const tags = pickKey(raw, "tags", "tags");
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags) || !tags.every((x) => typeof x === "string")) {
        errors.push(err(`${path}.tags`, "type", "tags must be string[]"));
        return undefined;
      }
      goal.tags = tags as string[];
    }
    if (!addOptionalAcceptanceCriterionIds(goal, raw, path, errors, allowedAcIds)) return undefined;
    return goal;
}

function parseSuite(
  raw: unknown,
  index: number,
  path: string,
  envIds: Set<string>,
  errors: ConfigError[],
): TestSuite | undefined {
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", `suites[${index}] must be an object`));
    return undefined;
  }
  const id = asString(pickKey(raw, "id", "id"), `${path}.id`, "id", errors);
  const environment = asString(pickKey(raw, "environment", "environment"), `${path}.environment`, "environment", errors);
  if (!id || !environment) return undefined;
  if (!envIds.has(environment)) {
    errors.push(
      err(
        `${path}.environment`,
        "unknown_environment",
        `Suite "${id}" references unknown environment "${environment}". Defined environments: ${[...envIds].join(", ") || "(none)"}`,
      ),
    );
    return undefined;
  }

  const acParsed = parseSuiteAcceptanceCriteria(
    pickKey(raw, "acceptance_criteria", "acceptanceCriteria"),
    `${path}.acceptance_criteria`,
    errors,
  );
  if (pickKey(raw, "acceptance_criteria", "acceptanceCriteria") != null && acParsed === undefined) {
    return undefined;
  }
  const allowedAcIds = acParsed?.idSet;
  const orderedAcIds = acParsed?.list.map((c) => c.id) ?? [];

  const goalsRaw = pickKey(raw, "goals", "goals");
  if (!Array.isArray(goalsRaw) || goalsRaw.length === 0) {
    errors.push(err(`${path}.goals`, "required", `Suite "${id}" must declare a non-empty goals array`));
    return undefined;
  }
  const goals: TestGoal[] = [];
  goalsRaw.forEach((g, gi) => {
    const goal = parseGoal(g, `${path}.goals[${gi}]`, errors, allowedAcIds, orderedAcIds);
    if (goal) goals.push(goal);
  });
  if (goals.length !== goalsRaw.length) return undefined;

  const suite: TestSuite = { id, environment, goals };
  const desc = pickKey(raw, "description", "description");
  if (desc !== undefined && desc !== null) {
    const d = asString(desc, `${path}.description`, "description", errors);
    if (d) suite.description = d;
  }
  const us = pickKey(raw, "user_story", "userStory");
  if (us !== undefined && us !== null) {
    const story = asString(us, `${path}.user_story`, "user_story", errors);
    if (!story) return undefined;
    suite.userStory = story;
  }
  if (acParsed) suite.acceptanceCriteria = acParsed.list;
  const tags = pickKey(raw, "tags", "tags");
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags) || !tags.every((x) => typeof x === "string")) {
      errors.push(err(`${path}.tags`, "type", "tags must be string[]"));
      return undefined;
    }
    suite.tags = tags as string[];
  }
  const rp = parseRetryPolicy(pickKey(raw, "retry_policy", "retryPolicy"), `${path}.retry_policy`, errors);
  if (rp) suite.retryPolicy = rp;
  const dto = asPosInt(
    pickKey(raw, "default_timeout_ms", "defaultTimeoutMs"),
    `${path}.default_timeout_ms`,
    "default_timeout_ms",
    errors,
  );
  if (dto !== undefined) suite.defaultTimeoutMs = dto;
  const ap = parseArtifactPolicy(pickKey(raw, "artifact_policy", "artifactPolicy"), `${path}.artifact_policy`, errors);
  if (ap) suite.artifactPolicy = ap;
  return suite;
}

function mergeDefaults(suite: TestSuite, defaults: ConfigDefaults | undefined): TestSuite {
  if (!defaults) return suite;
  const merged: TestSuite = { ...suite };
  if (merged.retryPolicy === undefined && defaults.retryPolicy !== undefined) {
    merged.retryPolicy = { ...defaults.retryPolicy };
  }
  if (merged.defaultTimeoutMs === undefined && defaults.defaultTimeoutMs !== undefined) {
    merged.defaultTimeoutMs = defaults.defaultTimeoutMs;
  }
  if (merged.artifactPolicy === undefined && defaults.artifactPolicy !== undefined) {
    merged.artifactPolicy = { ...defaults.artifactPolicy };
  }
  return merged;
}

function collectUnknownRootKeys(raw: Record<string, unknown>, errors: ConfigError[]): void {
  for (const k of Object.keys(raw)) {
    if (!ROOT_KEYS.has(k)) {
      errors.push(
        err(
          "",
          "unknown_root_key",
          `Unknown root key "${k}". Allowed: schema_version, keys, defaults, environments, suites, adapter_hooks, target_url_overrides`,
        ),
      );
    }
  }
}

/**
 * Parse and validate a config document (already decoded from YAML/JSON).
 */
export function validateConfigDocument(raw: unknown): { ok: true; config: RestormelTestingConfig } | { ok: false; errors: ConfigError[] } {
  const errors: ConfigError[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: [err("", "root_type", "Config root must be a plain object")] };
  }
  collectUnknownRootKeys(raw, errors);

  const schemaRaw = pickKey(raw, "schema_version", "schemaVersion");
  let schemaStr: string | undefined;
  if (schemaRaw === undefined || schemaRaw === null) {
    errors.push(err("schema_version", "required", 'schema_version is required (use "1")'));
  } else if (typeof schemaRaw !== "string") {
    errors.push(err("schema_version", "type", "schema_version must be a string"));
  } else if (schemaRaw.trim() === "") {
    errors.push(err("schema_version", "empty", "schema_version must be non-empty"));
  } else {
    schemaStr = schemaRaw.trim();
    if (!(SUPPORTED_SCHEMA_VERSIONS as readonly string[]).includes(schemaStr)) {
      errors.push(
        err(
          "schema_version",
          "unsupported",
          `Unsupported schema_version "${schemaStr}". Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`,
        ),
      );
    }
  }
  const environmentsRaw = pickKey(raw, "environments", "environments");
  if (!isPlainObject(environmentsRaw)) {
    errors.push(err("environments", "required", "environments must be a non-empty object of id → profile"));
    return { ok: false, errors };
  }
  const envKeys = Object.keys(environmentsRaw);
  if (envKeys.length === 0) {
    errors.push(err("environments", "required", "Define at least one environment"));
    return { ok: false, errors };
  }
  const environments: Record<string, EnvironmentProfile> = {};
  const envIdSet = new Set<string>();
  for (const envId of envKeys) {
    const p = parseEnvironment(envId, (environmentsRaw as Record<string, unknown>)[envId], `environments.${envId}`, errors);
    if (p) {
      environments[envId] = p;
      envIdSet.add(envId);
    }
  }

  const globalKeys = parseKeysMap(pickKey(raw, "keys", "keys"), "keys", errors);
  const defaults = parseDefaults(pickKey(raw, "defaults", "defaults"), "defaults", errors);

  const suitesRaw = pickKey(raw, "suites", "suites");
  if (!Array.isArray(suitesRaw) || suitesRaw.length === 0) {
    errors.push(err("suites", "required", "suites must be a non-empty array"));
    return { ok: false, errors };
  }
  const suites: TestSuite[] = [];
  suitesRaw.forEach((s, i) => {
    const suite = parseSuite(s, i, `suites[${i}]`, envIdSet, errors);
    if (suite) suites.push(mergeDefaults(suite, defaults));
  });

  const adapterHooks = parseStringMap(
    pickKey(raw, "adapter_hooks", "adapterHooks"),
    "adapter_hooks",
    errors,
    "adapter hook command",
  );
  const targetUrlOverrides = parseUrlOverrideMap(
    pickKey(raw, "target_url_overrides", "targetUrlOverrides"),
    "target_url_overrides",
    errors,
  );

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (!schemaStr || !(SUPPORTED_SCHEMA_VERSIONS as readonly string[]).includes(schemaStr)) {
    return {
      ok: false,
      errors: [err("schema_version", "invalid", "schema_version is missing or unsupported after validation")],
    };
  }

  if (suites.length !== suitesRaw.length) {
    return { ok: false, errors: [err("suites", "parse", "One or more suites failed validation")] };
  }

  const config: RestormelTestingConfig = {
    schemaVersion: schemaStr as SupportedSchemaVersion,
    keys: globalKeys,
    defaults,
    environments,
    suites,
    adapterHooks,
    targetUrlOverrides,
  };

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, config };
}

/**
 * Reserved for future policy checks (e.g. schema_version gates). Shell hooks are executed when not skipped via env; see runner docs.
 */
export function validateMvpRunnerRestrictions(_config: RestormelTestingConfig, _errors: ConfigError[]): void {
  /* no-op: adapter_hooks, preconditions, and cleanup are supported by the runner */
}

function parseStringMap(
  raw: unknown,
  path: string,
  errors: ConfigError[],
  valueLabel: string,
): Record<string, string> {
  if (raw === undefined || raw === null) return {};
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", `${path} must be an object of string → string`));
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = asString(v, `${path}.${k}`, valueLabel, errors);
    if (!s) continue;
    if (looksLikeInlineSecret(s)) {
      errors.push(err(`${path}.${k}`, "unsafe", "Value looks like an inline secret; use refs or env vars outside this file"));
      continue;
    }
    out[k] = s;
  }
  return out;
}

function parseUrlOverrideMap(
  raw: unknown,
  path: string,
  errors: ConfigError[],
): Record<string, string> {
  if (raw === undefined || raw === null) return {};
  if (!isPlainObject(raw)) {
    errors.push(err(path, "type", `${path} must be an object of environment id → URL`));
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = asString(v, `${path}.${k}`, "override URL", errors);
    if (!s) continue;
    const chk = isSafeHttpUrl(s);
    if (!chk.ok) {
      errors.push(err(`${path}.${k}`, "url", `${k}: ${chk.reason}`));
      continue;
    }
    out[k] = s;
  }
  return out;
}

export function resolveSuite(
  config: RestormelTestingConfig,
  suiteId: string,
): { ok: true; suite: TestSuite } | { ok: false; errors: ConfigError[] } {
  const suite = config.suites.find((s) => s.id === suiteId);
  if (!suite) {
    return {
      ok: false,
      errors: [
        err(
          "suites",
          "suite_not_found",
          `No suite with id "${suiteId}". Available: ${config.suites.map((s) => s.id).join(", ") || "(none)"}`,
        ),
      ],
    };
  }
  return { ok: true, suite };
}

export function resolveEnvironmentProfile(
  config: RestormelTestingConfig,
  environmentId: string,
): { ok: true; profile: EnvironmentProfile } | { ok: false; errors: ConfigError[] } {
  const base = config.environments[environmentId];
  if (!base) {
    return {
      ok: false,
      errors: [
        err(
          "environments",
          "unknown_environment",
          `No environment "${environmentId}". Defined: ${Object.keys(config.environments).join(", ") || "(none)"}`,
        ),
      ],
    };
  }
  const override = config.targetUrlOverrides[environmentId];
  if (override === undefined) {
    return { ok: true, profile: { ...base } };
  }
  return { ok: true, profile: { ...base, baseUrl: override } };
}

/** Merge global keys with environment-specific keys (env wins on collision). */
export function resolvedKeysForEnvironment(
  config: RestormelTestingConfig,
  environmentId: string,
): Record<string, string> {
  const env = config.environments[environmentId];
  return { ...config.keys, ...(env?.keys ?? {}) };
}

/** Human-readable multi-line summary for CLI or CI logs. */
export function formatConfigErrors(errors: ConfigError[]): string {
  return errors
    .map((e) => {
      const loc = e.path === "" ? "(root)" : e.path;
      return `${loc}: ${e.message} [${e.code}]`;
    })
    .join("\n");
}

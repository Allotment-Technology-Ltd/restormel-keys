export type ParsedCli =
  | { kind: "help"; topic?: string }
  | { kind: "version" }
  | { kind: "init"; config: string; print: boolean; force: boolean }
  | { kind: "validate"; config: string; json: boolean }
  | {
      kind: "run";
      /** One or more suite ids (`--suite` repeatable or `--suites a,b`). */
      suites: string[];
      config: string;
      environmentId?: string;
      targetUrl?: string;
      commitSha?: string;
      repository?: string;
      artifactDir?: string;
      headless: boolean;
      trigger: "local" | "ci";
      goalIds?: string[];
      /** Filter goals by suite `acceptance_criterion_ids` (comma-separated). */
      acceptanceCriterionIds?: string[];
      json: boolean;
    }
  | { kind: "report"; path: string }
  | {
      kind: "release-pack";
      fromRun: string;
      out: string;
      routeVersion?: string;
      policyVersion?: string;
      routeId?: string;
      policyId?: string;
    }
  | { kind: "doctor"; config?: string }
  | { kind: "telemetry"; action: "status" | "disable" | "enable" }
  | { kind: "error"; message: string };

function parseInitArgs(args: string[]): ParsedCli {
  let config = "restormel-testing.yaml";
  let print = false;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--print") {
      print = true;
      continue;
    }
    if (a === "--force") {
      force = true;
      continue;
    }
    if (a === "--config" || a === "-c") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "init: --config requires a file path" };
      }
      config = v;
      continue;
    }
    if (a === "-h" || a === "--help") {
      return { kind: "help", topic: "init" };
    }
    return { kind: "error", message: `init: unexpected argument: ${a}` };
  }
  return { kind: "init", config, print, force };
}

function parseValidateArgs(args: string[]): ParsedCli {
  let config = "restormel-testing.yaml";
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--config" || a === "-c") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "validate: --config requires a file path" };
      }
      config = v;
      continue;
    }
    if (a === "-h" || a === "--help") {
      return { kind: "help", topic: "validate" };
    }
    return { kind: "error", message: `validate: unexpected argument: ${a}` };
  }
  return { kind: "validate", config, json };
}

function parseRunArgs(args: string[]): ParsedCli {
  const suites: string[] = [];
  let config = "restormel-testing.yaml";
  let environmentId: string | undefined;
  let targetUrl: string | undefined;
  let commitSha: string | undefined;
  let repository: string | undefined;
  let artifactDir: string | undefined;
  let headless = true;
  let trigger: "local" | "ci" = "local";
  const goalIds: string[] = [];
  const acceptanceCriterionIds: string[] = [];
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--suite") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --suite requires a value" };
      }
      suites.push(v);
      continue;
    }
    if (a === "--suites") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --suites requires a comma-separated list" };
      }
      for (const part of v.split(",")) {
        const id = part.trim();
        if (id.length > 0) suites.push(id);
      }
      continue;
    }
    if (a === "--goal") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --goal requires a value" };
      }
      for (const part of v.split(",")) {
        const id = part.trim();
        if (id.length > 0) goalIds.push(id);
      }
      continue;
    }
    if (a === "--ac") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --ac requires a value" };
      }
      for (const part of v.split(",")) {
        const id = part.trim();
        if (id.length > 0) acceptanceCriterionIds.push(id);
      }
      continue;
    }
    if (a === "--environment" || a === "--env") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --environment requires a value" };
      }
      environmentId = v;
      continue;
    }
    if (a === "--target-url") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --target-url requires a value" };
      }
      targetUrl = v;
      continue;
    }
    if (a === "--commit-sha") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --commit-sha requires a value" };
      }
      commitSha = v;
      continue;
    }
    if (a === "--repository") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --repository requires a value" };
      }
      repository = v;
      continue;
    }
    if (a === "--config" || a === "-c") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --config requires a file path" };
      }
      config = v;
      continue;
    }
    if (a === "--artifact-dir") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "run: --artifact-dir requires a directory path" };
      }
      artifactDir = v;
      continue;
    }
    if (a === "--headed") {
      headless = false;
      continue;
    }
    if (a === "--ci") {
      trigger = "ci";
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "-h" || a === "--help") {
      return { kind: "help", topic: "run" };
    }
    return { kind: "error", message: `run: unexpected argument: ${a}` };
  }

  if (suites.length === 0) {
    return { kind: "error", message: "run: provide --suite <name> (repeatable) or --suites a,b,c" };
  }

  return {
    kind: "run",
    suites,
    config,
    environmentId,
    targetUrl,
    commitSha,
    repository,
    artifactDir,
    headless,
    trigger,
    goalIds: goalIds.length > 0 ? goalIds : undefined,
    acceptanceCriterionIds: acceptanceCriterionIds.length > 0 ? acceptanceCriterionIds : undefined,
    json,
  };
}

function parseReportArgs(args: string[]): ParsedCli {
  const rest = [...args];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "-h" || rest[i] === "--help") {
      return { kind: "help", topic: "report" };
    }
  }
  const pos = rest.filter((a) => !a.startsWith("-"));
  if (pos.length === 0) {
    return { kind: "error", message: "report: requires a path to a run directory or run.json" };
  }
  if (pos.length > 1) {
    return { kind: "error", message: "report: too many arguments" };
  }
  return { kind: "report", path: pos[0]! };
}

function parseTelemetryArgs(args: string[]): ParsedCli {
  const rest = [...args];
  for (const a of rest) {
    if (a === "-h" || a === "--help") {
      return { kind: "help", topic: "telemetry" };
    }
  }
  const pos = rest.filter((a) => !a.startsWith("-"));
  const sub = pos[0]?.toLowerCase();
  if (sub === undefined || sub === "status") {
    return { kind: "telemetry", action: "status" };
  }
  if (sub === "disable") {
    return { kind: "telemetry", action: "disable" };
  }
  if (sub === "enable") {
    return { kind: "telemetry", action: "enable" };
  }
  return { kind: "error", message: `telemetry: unknown subcommand: ${pos[0]}` };
}

function parseReleasePackArgs(args: string[]): ParsedCli {
  let fromRun = "";
  let out = "release-pack.json";
  let routeVersion: string | undefined;
  let policyVersion: string | undefined;
  let routeId: string | undefined;
  let policyId: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from-run") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "release-pack: --from-run requires a path" };
      }
      fromRun = v;
      continue;
    }
    if (a === "--out" || a === "-o") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "release-pack: --out requires a file path" };
      }
      out = v;
      continue;
    }
    if (a === "--route-version") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "release-pack: --route-version requires a value" };
      }
      routeVersion = v;
      continue;
    }
    if (a === "--policy-version") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "release-pack: --policy-version requires a value" };
      }
      policyVersion = v;
      continue;
    }
    if (a === "--route-id") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "release-pack: --route-id requires a value" };
      }
      routeId = v;
      continue;
    }
    if (a === "--policy-id") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "release-pack: --policy-id requires a value" };
      }
      policyId = v;
      continue;
    }
    if (a === "-h" || a === "--help") {
      return { kind: "help", topic: "release-pack" };
    }
    return { kind: "error", message: `release-pack: unexpected argument: ${a}` };
  }
  if (!fromRun) {
    return { kind: "error", message: "release-pack: --from-run <run-dir> is required" };
  }
  return {
    kind: "release-pack",
    fromRun,
    out,
    routeVersion,
    policyVersion,
    routeId,
    policyId,
  };
}

function parseDoctorArgs(args: string[]): ParsedCli {
  let config: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--config" || a === "-c") {
      const v = args[++i];
      if (!v || v.startsWith("-")) {
        return { kind: "error", message: "doctor: --config requires a file path" };
      }
      config = v;
      continue;
    }
    if (a === "-h" || a === "--help") {
      return { kind: "help", topic: "doctor" };
    }
    return { kind: "error", message: `doctor: unexpected argument: ${a}` };
  }
  return { kind: "doctor", config };
}

/**
 * Parse argv with `process.argv.slice(2)` (no `node`, no executable).
 */
export function parseArgs(argv: string[]): ParsedCli {
  if (argv.length === 0) {
    return { kind: "help" };
  }

  const first = argv[0];
  if (first === "-h" || first === "--help") {
    return { kind: "help", topic: argv[1] };
  }
  if (first === "--version" || first === "-v") {
    return { kind: "version" };
  }

  if (first === "help") {
    return { kind: "help", topic: argv[1] };
  }

  const rest = argv.slice(1);

  if (first === "init") {
    return parseInitArgs(rest);
  }
  if (first === "validate") {
    return parseValidateArgs(rest);
  }
  if (first === "run") {
    return parseRunArgs(rest);
  }
  if (first === "report") {
    return parseReportArgs(rest);
  }
  if (first === "release-pack") {
    return parseReleasePackArgs(rest);
  }
  if (first === "doctor") {
    return parseDoctorArgs(rest);
  }
  if (first === "telemetry") {
    return parseTelemetryArgs(rest);
  }

  return { kind: "error", message: `Unknown command: ${first}` };
}

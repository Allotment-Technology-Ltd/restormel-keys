import { spawn } from "node:child_process";

function hookTimeoutMs(): number {
  const raw = process.env.RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS?.trim();
  if (raw === undefined || raw === "") return 120_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}

/**
 * Runs shell commands from config (preconditions, cleanup, adapter_hooks).
 * Set `RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1` to no-op (e.g. untrusted CI).
 */
export async function runShellHookCommands(
  commands: string[],
  opts: { cwd: string; label: string },
): Promise<{ ok: true } | { ok: false; message: string; exitCode: number | null }> {
  if (process.env.RESTORMEL_TESTING_SKIP_SHELL_HOOKS?.trim() === "1") {
    return { ok: true };
  }
  const timeoutMs = hookTimeoutMs();
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]!.trim();
    if (cmd.length === 0) continue;
    const code = await runOneShellCommand(cmd, opts.cwd, timeoutMs, process.env);
    if (code !== 0) {
      return {
        ok: false,
        message: `${opts.label}: command ${i + 1} exited with code ${code === null ? "signal" : code}`,
        exitCode: code,
      };
    }
  }
  return { ok: true };
}

function runOneShellCommand(
  cmd: string,
  cwd: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(cmd, {
      shell: true,
      cwd,
      env,
      stdio: "inherit",
    });
    const t = setTimeout(() => {
      child.kill("SIGTERM");
      resolve(124);
    }, timeoutMs);
    child.on("error", () => {
      clearTimeout(t);
      resolve(1);
    });
    child.on("exit", (code) => {
      clearTimeout(t);
      resolve(code);
    });
  });
}

function missionExecutorTimeoutMs(maxDurationMsHint?: number): number {
  const hook = hookTimeoutMs();
  if (maxDurationMsHint !== undefined && maxDurationMsHint > 0) {
    return Math.max(hook, maxDurationMsHint);
  }
  return hook;
}

/**
 * Runs `mission_executor` once with extra env (see docs/testing/agent-missions.md).
 * Set `RESTORMEL_TESTING_SKIP_MISSION_EXECUTOR=1` to no-op (e.g. CI without an agent binary).
 */
export async function runMissionExecutorCommand(
  command: string,
  opts: {
    cwd: string;
    label: string;
    extraEnv: Record<string, string | undefined>;
    maxDurationMsHint?: number;
  },
): Promise<{ ok: true } | { ok: false; message: string; exitCode: number | null }> {
  if (process.env.RESTORMEL_TESTING_SKIP_MISSION_EXECUTOR?.trim() === "1") {
    return { ok: true };
  }
  const cmd = command.trim();
  if (cmd.length === 0) {
    return { ok: false, message: `${opts.label}: mission_executor is empty`, exitCode: null };
  }
  const timeoutMs = missionExecutorTimeoutMs(opts.maxDurationMsHint);
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [k, v] of Object.entries(opts.extraEnv)) {
    if (v !== undefined) env[k] = v;
  }
  const code = await runOneShellCommand(cmd, opts.cwd, timeoutMs, env);
  if (code !== 0) {
    const detail =
      code === 124
        ? `timed out after ${timeoutMs}ms`
        : `exited with code ${code === null ? "signal" : code}`;
    return {
      ok: false,
      message: `${opts.label}: mission_executor ${detail}`,
      exitCode: code,
    };
  }
  return { ok: true };
}

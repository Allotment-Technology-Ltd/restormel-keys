import type { Command } from "commander";
import chalk from "chalk";
import * as fs from "node:fs";
import * as path from "node:path";

function resolveSiteBase(): string {
  const env = typeof process !== "undefined" ? process.env.RESTORMEL_KEYS_BASE?.trim() : "";
  if (env) return env.replace(/\/$/, "");
  return "https://restormel.dev";
}

function envSnippet(accessToken: string, projectId: string, siteBase: string): string {
  const base = siteBase.replace(/\/$/, "");
  return [
    "# Restormel Keys — keep out of git (for example add .env.local to .gitignore)",
    `RESTORMEL_GATEWAY_KEY=${accessToken}`,
    `RESTORMEL_PROJECT_ID=${projectId}`,
    `RESTORMEL_KEYS_BASE=${base}`,
    "",
  ].join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function registerLogin(program: Command) {
  program
    .command("login")
    .description("Device login: create a Gateway key in your terminal via browser approval (OAuth-style device flow)")
    .option("--site-base <url>", "Restormel site origin (default RESTORMEL_KEYS_BASE or https://restormel.dev)")
    .option("--write-env <file>", "Append env lines to this file (creates if missing)")
    .action(
      async (opts: { siteBase?: string; writeEnv?: string }) => {
        const siteBase = (opts.siteBase ?? resolveSiteBase()).replace(/\/$/, "");
        const startUrl = `${siteBase}/keys/dashboard/api/cli/device/start`;
        const tokenUrl = `${siteBase}/keys/dashboard/api/cli/device/token`;

        let startRes: Response;
        try {
          startRes = await fetch(startUrl, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        } catch (e) {
          console.error(chalk.red(`Could not reach ${startUrl}`), e instanceof Error ? e.message : e);
          process.exitCode = 1;
          return;
        }

        const startJson = (await startRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (!startRes.ok) {
          console.error(chalk.red("Device session start failed:"), startJson.error ?? startRes.status);
          process.exitCode = 1;
          return;
        }

        const device_code = startJson.device_code as string;
        const user_code = startJson.user_code as string;
        const verification_uri_complete = startJson.verification_uri_complete as string;
        let intervalSec = Number(startJson.interval ?? 5);
        if (!Number.isFinite(intervalSec) || intervalSec < 1) intervalSec = 5;

        console.log(chalk.bold("\nRestormel Keys — device login\n"));
        console.log("Open this URL in your browser (signed in to Restormel):");
        console.log(chalk.cyan(verification_uri_complete));
        console.log("\nUser code:", chalk.bold(user_code));
        console.log("\nWaiting for authorization…\n");

        let waitMs = intervalSec * 1000;
        const maxPolls = 150;
        for (let poll = 0; poll < maxPolls; poll++) {
          await sleep(waitMs);
          let tokenRes: Response;
          try {
            tokenRes = await fetch(tokenUrl, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ device_code }),
            });
          } catch (e) {
            console.error(chalk.red("Token poll failed:"), e instanceof Error ? e.message : e);
            process.exitCode = 1;
            return;
          }

          const tokenJson = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
          if (tokenRes.ok && typeof tokenJson.access_token === "string") {
            const snippet = envSnippet(
              tokenJson.access_token,
              tokenJson.project_id as string,
              siteBase
            );
            console.log(chalk.green("Authorized. Gateway key received.\n"));
            console.log(snippet);
            const wf = opts.writeEnv?.trim();
            if (wf) {
              const abs = path.resolve(process.cwd(), wf);
              const line = "\n" + snippet;
              fs.appendFileSync(abs, line, "utf8");
              console.log(chalk.dim(`\nAppended to ${abs}`));
            } else {
              console.log(
                chalk.dim("\nTip: pass --write-env .env.local to append these lines automatically.")
              );
            }
            return;
          }

          const err = tokenJson.error as string | undefined;
          if (err === "authorization_pending") {
            if (poll >= maxPolls - 1) {
              console.error(chalk.red("Timed out waiting for authorization."));
              process.exitCode = 1;
              return;
            }
            continue;
          }
          if (err === "slow_down") {
            waitMs = Math.min(waitMs + 2500, 60_000);
            continue;
          }
          console.error(chalk.red("Login failed:"), err ?? tokenRes.status);
          process.exitCode = 1;
          return;
        }
        console.error(chalk.red("Timed out waiting for authorization."));
        process.exitCode = 1;
      }
    );
}

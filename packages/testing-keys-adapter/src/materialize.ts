/**
 * Read BYOK material from the environment. Variable name only — never the secret value in errors beyond "missing".
 */
export function readSecretFromEnv(secretEnvVar: string): { ok: true; apiKey: string } | { ok: false; message: string } {
  const name = secretEnvVar.startsWith("env:") ? secretEnvVar.slice("env:".length) : secretEnvVar;
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
    return { ok: false, message: `Invalid secret env var name: ${secretEnvVar}` };
  }
  const apiKey = process.env[name];
  if (apiKey === undefined || apiKey === "") {
    return { ok: false, message: `Environment variable ${name} is unset or empty` };
  }
  return { ok: true, apiKey };
}

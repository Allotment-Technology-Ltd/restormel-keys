/**
 * Public docs: agent prompt visibility gate.
 *
 * Progressive disclosure: the UI is collapsed by default.
 * Kill switch: set RESTORMEL_DOCS_AGENT_PROMPTS=false to hide entirely.
 */
export function areDocsAgentPromptsEnabled(): boolean {
  return (process.env.RESTORMEL_DOCS_AGENT_PROMPTS ?? "true").toLowerCase() !== "false";
}


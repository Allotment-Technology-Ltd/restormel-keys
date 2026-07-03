/**
 * Verifying proxy — MCP leg public surface (W2-1 Phase A).
 * (planning/w2-1-phase-a-reference-integration.md, REC-PLAN-009.)
 */
export {
  connectUpstreamTransport,
  connectUpstreamStdio,
  connectUpstreamHttp,
  callTool,
  callMode1Tool,
  parseMode1ToolResult,
  firstText,
  UpstreamCallError,
  PROXY_CLIENT_NAME,
  PROXY_CLIENT_VERSION,
  DEFAULT_CALLTOOL_TIMEOUT_MS,
  type UpstreamConnection,
} from "./client.js";

export {
  createMode1UpstreamServer,
  runMode1UpstreamStdio,
  answerFor,
  MODE1_TOOL_NAME,
  FIXTURE_ANSWER_AUTHOR,
  FIXTURE_EXPECTATIONS,
} from "./fixtures/mode1-upstream.js";

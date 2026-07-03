/**
 * logger — stderr-only structured logging. NEVER write to stdout: under the
 * stdio transport, stdout carries MCP protocol frames and any stray bytes
 * corrupt the stream.
 */
import type { LogLevel } from "./config.js";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
let threshold = ORDER.info;

/** Set the minimum level emitted; call once after config is loaded. */
export function setLogLevel(level: LogLevel): void {
  threshold = ORDER[level];
}

function emit(level: LogLevel, message: string): void {
  if (ORDER[level] < threshold) return;
  process.stderr.write(`[restormel-mcp-server] ${level.toUpperCase()} ${message}\n`);
}

export const logDebug = (m: string): void => emit("debug", m);
export const logInfo = (m: string): void => emit("info", m);
export const logWarn = (m: string): void => emit("warn", m);
export const logError = (m: string): void => emit("error", m);

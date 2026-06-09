/**
 * Suite-wide MCP tool names. The canonical list now lives in `@restormel/aaif` (the zero-dependency
 * single source of truth — Stage 5B / I10); this module re-exports it so existing
 * `./suite-tool-names.js` importers keep working. Keep `registerHorizonSuiteTools` in sync with the
 * aaif list.
 */
export {
  RESTORMEL_SUITE_TOOL_NAMES,
  getEnabledSuiteToolNames,
  type RestormelSuiteToolName,
  type SuiteToolModuleFlags,
} from "@restormel/aaif";

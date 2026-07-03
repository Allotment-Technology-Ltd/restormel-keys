# Changelog

All notable changes to `@restormel/state` are documented here.

## 0.2.0

- **Breaking:** Removed **`createStoaTurnDigestEvents`**, **`createStoaHistorySummarizationEvent`**, and **`createStoaScopeClearEvent`** from the package. Stoa is SOPHIA-specific; copy the reference implementations from [docs/restormel/state-sophia-integration.md](../../docs/restormel/state-sophia-integration.md) into the SOPHIA codebase (see “Reference module (copy into SOPHIA)”).

## 0.1.0

- Initial publish: `StateEvent` union, `MemoryPolicy`, `projectWorkingMemory`, prompt/debug helpers, context-pack + observability correlation helpers.

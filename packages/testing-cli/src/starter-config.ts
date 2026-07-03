/** Minimal valid `restormel-testing` document (schema v1). */
export const STARTER_CONFIG_YAML = `schema_version: "1"

# Optional global Keys logical refs (opaque; never put API keys here):
# keys:
#   llm_primary: ref:restormel-keys:llm/primary

environments:
  local:
    base_url: https://example.com

suites:
  - id: example
    environment: local
    goals:
      - id: smoke
        type: browser
        description: Replace with a real user-visible outcome for your app
        success_criteria:
          text_present:
            - Example Domain
`;

/** Named target environment: local, preview, staging, or custom ids. */
export interface EnvironmentProfile {
  id: string;
  baseUrl: string;
  /** How session/auth is supplied; values are runner-specific. */
  authMode?: "none" | "cookie_jar" | "storage_state";
  /**
   * Opaque path or env key name for auth material — never inline secrets.
   */
  authRef?: string;
  /**
   * Logical Keys refs by slot name, e.g. llm_primary → ref:restormel-keys:...
   */
  keys?: Record<string, string>;
  /**
   * Extra hostnames allowed for browser egress: built-in `ac_sequence` **`navigate`** and Playwright
   * **context route** blocking (scripts, fetch, XHR, WebSocket), in addition to the `base_url` origin.
   * List bare hostnames (e.g. `api.example.com`) or full `https://…` URLs (hostname is extracted). No secrets.
   */
  egressAllowHosts?: string[];
}

/** Re-export for CLI/tooling that expects auth in lib/. */
import { getSession } from "$lib/server/auth";

export const auth = {
  getSession,
};

/**
 * Profile & settings — server data + email-preference form action (REC-PLAN-028 Phase 3).
 *
 * Authz: this is a signed-in human surface. We resolve the session user with
 * `requireSessionUser` (throws 401 for signed-out / Bearer-key requests) so the
 * preference centre can NEVER load or mutate another account's consent. The dashboard
 * layout already redirects signed-out users to login; this is defence in depth.
 *
 * The preference centre reads/writes the sovereign `email_preferences` ledger. It only
 * governs MARKETING categories — transactional/security email has its own lawful basis
 * and is not switchable here (stated in the UI).
 */
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { requireSessionUser } from "$lib/server/session-user";
import {
  getPreferencesForUser,
  savePreferencesForUser,
  type CategoryFlags,
} from "$lib/server/email-preferences";

export const config = { runtime: "nodejs22.x" as const };

export const load: PageServerLoad = async ({ locals }) => {
  const user = requireSessionUser(locals);

  const prefs = await getPreferencesForUser(user.uid);
  // No row yet → opt-in defaults (all off, subscribed).
  const flags: CategoryFlags = {
    productUpdates: prefs?.productUpdates ?? false,
    newsletter: prefs?.newsletter ?? false,
    releaseNotes: prefs?.releaseNotes ?? false,
  };

  return {
    emailPreferences: {
      flags,
      unsubscribedAt: prefs?.unsubscribedAt ?? null,
      // Surfaced read-only so the user can see the provenance / withdrawal state.
      consentSource: prefs?.consentSource ?? null,
    },
  };
};

function readFlag(form: FormData, name: string): boolean {
  const v = form.get(name);
  // Checkbox semantics: present (any truthy value) = opted in; absent = opted out.
  return v === "on" || v === "true" || v === "1";
}

export const actions: Actions = {
  /** Save the per-category marketing email preferences for the signed-in user. */
  emailPreferences: async ({ request, locals }) => {
    const user = requireSessionUser(locals);
    const email = (user.email ?? "").trim();
    if (!email) {
      // No email on the session → nothing to key the ledger by.
      return fail(400, { prefStatus: "no_email" as const });
    }

    const form = await request.formData();
    const flags: CategoryFlags = {
      productUpdates: readFlag(form, "product_updates"),
      newsletter: readFlag(form, "newsletter"),
      releaseNotes: readFlag(form, "release_notes"),
    };

    const result = await savePreferencesForUser({ userId: user.uid, email, flags });
    if (!result.ok) {
      return fail(503, { prefStatus: "error" as const });
    }
    return { prefStatus: "saved" as const };
  },
};

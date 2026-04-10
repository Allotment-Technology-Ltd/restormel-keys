import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

const SLOTS_TOTAL = 50;

/** TODO: Replace with dynamic count (DB, CMS, or admin-configured). */
const SLOTS_REMAINING_HARDCODED = 0;

export const load: PageServerLoad = async () => {
  return {
    slotsRemaining: SLOTS_REMAINING_HARDCODED,
    slotsTotal: SLOTS_TOTAL,
  };
};

const MODULE_VALUES = ["keys", "testing", "graph", "platform"] as const;

function parseModules(formData: FormData): string[] {
  const raw = formData.getAll("modules");
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v).trim().toLowerCase();
    if (MODULE_VALUES.includes(s as (typeof MODULE_VALUES)[number])) out.push(s);
  }
  return out;
}

export const actions: Actions = {
  default: async ({ request, fetch: serverFetch }) => {
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const building = String(formData.get("building") ?? "").trim();
    const modules = parseModules(formData);
    const stack = String(formData.get("stack") ?? "").trim();
    const howFound = String(formData.get("howFound") ?? "").trim();
    const listed = String(formData.get("listed") ?? "").trim();

    const errors: Record<string, string> = {};
    if (!name) errors.name = "Name is required.";
    if (!email) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    if (!building) errors.building = "Tell us what you’re building.";
    if (modules.length === 0) errors.modules = "Pick at least one module.";
    if (listed !== "yes" && listed !== "no") errors.listed = "Please choose whether we may list you.";

    const values = {
      name,
      email,
      building,
      modules,
      stack,
      howFound,
      listed,
    };

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values, success: false as const });
    }

    const payload = {
      type: "founders_application",
      submittedAt: new Date().toISOString(),
      name,
      email,
      building,
      modules,
      stack: stack || null,
      howFound: howFound || null,
      listedPublicly: listed === "yes",
    };

    const webhook = (process.env.FOUNDERS_APPLICATION_WEBHOOK_URL ?? "").trim();
    if (webhook) {
      try {
        const res = await serverFetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          return fail(502, {
            errors: { _form: "We could not submit your application. Please try again or email us." },
            values,
            success: false as const,
          });
        }
      } catch {
        return fail(502, {
          errors: { _form: "We could not submit your application. Please try again later." },
          values,
          success: false as const,
        });
      }
    }
    // No webhook: accept and show confirmation (TODO: persist or notify when webhook unset).
    return { success: true as const };
  },
};

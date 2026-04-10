import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  createSupportRateLimiter,
  isSupportRuntimeConfigured,
  parseSupportMessages,
  supportChatToTextStreamResponse,
  supportModelFromEnv,
} from "@restormel/support";

export const config = { runtime: "nodejs20.x" as const };

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const limiter = createSupportRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
});

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupportRuntimeConfigured(process.env)) {
    return json({ error: "Unavailable" }, { status: 503 });
  }

  if (!limiter.tryConsume(locals.user.uid)) {
    return json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawMessages =
    body && typeof body === "object" && body !== null && "messages" in body
      ? (body as { messages: unknown }).messages
      : undefined;

  const messages = parseSupportMessages(rawMessages);
  if (!messages) {
    return json({ error: "Invalid messages" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return json({ error: "Unavailable" }, { status: 503 });
  }

  return supportChatToTextStreamResponse({
    messages,
    openaiApiKey: apiKey,
    model: supportModelFromEnv(process.env),
  });
};

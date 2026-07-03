import { createKeysHandler } from "$lib/server/keys";
import { openaiProvider, anthropicProvider } from "@restormel/keys";

const handler = createKeysHandler([openaiProvider, anthropicProvider]);

export async function GET({ request }: { request: Request }) {
  return handler(request);
}

export async function DELETE({ request }: { request: Request }) {
  return handler(request);
}

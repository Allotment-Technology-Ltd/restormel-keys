import { createKeysHandler } from "@/app/lib/keys-server";
import { openaiProvider, anthropicProvider } from "@restormel/keys";

const handler = createKeysHandler([openaiProvider, anthropicProvider]);

export async function GET(req: Request) {
  return handler(req);
}

export async function DELETE(req: Request) {
  return handler(req);
}

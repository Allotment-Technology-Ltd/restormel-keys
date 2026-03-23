import { createKeysHandler } from "@/app/lib/keys-server";
import { FALLBACK_PROVIDERS } from "@/app/lib/catalog";

const handler = createKeysHandler(FALLBACK_PROVIDERS);

export async function GET(req: Request) {
  return handler(req);
}

export async function DELETE(req: Request) {
  return handler(req);
}

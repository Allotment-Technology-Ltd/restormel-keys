import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  try {
    const filePath = resolve(process.cwd(), "docs/api/openapi.yaml");
    const yaml = await readFile(filePath, "utf8");
    return new Response(yaml, {
      status: 200,
      headers: {
        "content-type": "application/yaml; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};

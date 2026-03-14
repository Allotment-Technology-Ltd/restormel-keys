import { c as createKeysHandler } from "../../../../chunks/keys.js";
import { o as openaiProvider, a as anthropicProvider } from "../../../../chunks/anthropic.js";
const handler = createKeysHandler([openaiProvider, anthropicProvider]);
async function GET({ request }) {
  return handler(request);
}
async function POST({ request }) {
  return handler(request);
}
export {
  GET,
  POST
};

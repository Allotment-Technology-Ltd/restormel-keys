/**
 * Record markdown body → HTML for the public publish layer. Raw HTML disabled (records are
 * trusted but published; keep injection off); http(s) links open in a new tab. Mirrors the
 * changelog renderer's safe config.
 */
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex("href");
  if (hrefIndex >= 0) {
    const href = token.attrs?.[hrefIndex]?.[1];
    if (href && /^https?:\/\//i.test(href)) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }
  }
  return self.renderToken(tokens, idx, options);
};

export function renderRecordBody(body: string): string {
  return body.trim() ? md.render(body) : "";
}

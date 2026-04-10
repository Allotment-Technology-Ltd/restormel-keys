/**
 * GitHub-flavoured release notes → HTML. Raw HTML in markdown is disabled; http(s) links open in a new tab.
 */
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

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

export function renderReleaseMarkdown(body: string): string {
  return body.trim() ? md.render(body) : "";
}

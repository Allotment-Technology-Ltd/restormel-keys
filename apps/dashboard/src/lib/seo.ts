// Use typeof window to check for browser environment instead of $app/environment
// to avoid SSR issues where $app/environment might not be available.
const browser = typeof window !== "undefined";

export type SeoMeta = {
  title: string;
  description?: string;
  canonicalPath: string;
  robots?: string;
  ogImagePath?: string;
};

/**
 * Default OG image path — 1200×630 PNG (social platforms require PNG/JPEG, not SVG).
 * Served from static/og/default.png.
 */
export const DEFAULT_OG_IMAGE_PATH = "/og/default.png";

export function defaultSeo(opts: {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  ogImagePath?: string;
}): SeoMeta {
  return {
    title: opts.title,
    description: opts.description,
    canonicalPath: opts.canonicalPath,
    robots: opts.robots,
    ogImagePath: opts.ogImagePath ?? DEFAULT_OG_IMAGE_PATH,
  };
}

export function absoluteUrl(base: URL, path: string): string {
  const u = new URL(base.toString());
  u.pathname = path;
  u.search = "";
  u.hash = "";
  return u.toString();
}

export function currentOrigin(): string | null {
  if (!browser) return null;
  return window.location.origin;
}


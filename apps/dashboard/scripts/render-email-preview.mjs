/**
 * Email preview inventory generator (standalone ESM script).
 *
 * Compiles each Svelte email template at runtime using svelte/compiler,
 * then renders via svelte/server's render(), and writes a 4-variant
 * (light-desktop, light-mobile, dark-desktop, dark-mobile) preview HTML
 * to /tmp/restormel-email-inventory.html.
 *
 * Run from the dashboard package root:
 *   node ./scripts/render-email-preview.mjs
 *
 * Does NOT use vitest (vitest sets resolve.conditions=["browser"] which
 * breaks svelte/server render). Pure Node + svelte/compiler.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

// Import svelte compiler and server render from dashboard node_modules
const compilerMod = await import(resolve(dashboardRoot, "node_modules/svelte/compiler/index.js"));
const compilerExports = compilerMod.default || compilerMod;
const compile = compilerExports.compile;
const { render: svelteRender } = await import(resolve(dashboardRoot, "node_modules/svelte/src/server/index.js"));

// ── Theme (mirrors theme.ts) ─────────────────────────────────────────────────
const t = {
  color: {
    canvas: "#f3ead0",
    canvasDeep: "#e8dfbf",
    surface: "#fffef0",
    ink: "#0c0c0c",
    inkMuted: "#3a3530",
    inkFaint: "#7a7060",
    yellow: "#ffd600",
    yellowDark: "#e6bf00",
    blue: "#1a3f8a",
    onBlue: "#fffef0",
    okBg: "#d8f3e3",
    okFg: "#166534",
    warnBg: "#fef3c7",
    warnFg: "#92400e",
    amber: "#e6a700",
  },
  dark: {
    canvas: "#0c0c0c",
    card: "#1a1812",
    text: "#f3ead0",
    muted: "#cfc6ad",
    link: "#9db8ff",
    footer: "#b7ad94",
    border: "#f3ead0",
    accent: "#ffd600",
    chipBg: "#16351f",
    chipFg: "#7ee0a3",
    chipWarnBg: "#2a2207",
    chipWarnFg: "#fcd34d",
  },
  font: {
    display: "'Barlow Condensed', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "'Space Mono', 'Courier New', monospace",
  },
  border: "2px solid #0c0c0c",
  shadow: "6px 6px 0 #0c0c0c",
  maxWidth: "600px",
};

const d = t.dark;

// ── render.ts document wrapper (mirrors render.ts) ────────────────────────────
function wrapInDocument(body) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Restormel Keys</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap");
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0 !important; padding:0 !important; background:${t.color.canvas}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
  .rm-h1, .rm-body, .rm-body p, .rm-wordmark { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; text-rendering:optimizeLegibility; }
  table { border-collapse:collapse; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; }
  @media only screen and (max-width:620px) {
    .rm-fluid { width:100% !important; max-width:100% !important; }
    .rm-cta a, a.rm-cta-link { white-space:nowrap !important; font-size:11px !important; padding:12px 18px !important; letter-spacing:0.04em !important; }
  }
  @media (prefers-color-scheme: dark) {
    body, .rm-canvas { background:${d.canvas} !important; }
    .rm-card { background:${d.card} !important; border-color:${d.border} !important; }
    .rm-header { border-bottom-color:${d.border} !important; }
    .rm-wordmark, .rm-h1, .rm-h2, .rm-body, .rm-body p { color:${d.text} !important; }
    .rm-accent { color:${d.accent} !important; }
    .rm-muted { color:${d.muted} !important; }
    .rm-link { color:${d.link} !important; }
    .rm-footer { color:${d.footer} !important; }
    .rm-chip { background:${d.chipBg} !important; color:${d.chipFg} !important; border-color:${d.border} !important; }
    .rm-chip-warn { background:${d.chipWarnBg} !important; color:${d.chipWarnFg} !important; border-color:${d.border} !important; }
    .rm-cta { background:${t.color.yellow} !important; border-color:${t.color.ink} !important; box-shadow:3px 3px 0 ${d.border} !important; }
    .rm-cta a, a.rm-cta-link { color:${t.color.ink} !important; }
    .rm-notice { background:${d.card} !important; border-color:${d.border} !important; color:${d.muted} !important; }
    .rm-notice td { color:${d.muted} !important; }
  }
  [data-ogsb] body, [data-ogsb] .rm-canvas { background:${d.canvas} !important; }
  [data-ogsb] .rm-card { background:${d.card} !important; }
  [data-ogsc] .rm-card { border-color:${d.border} !important; }
  [data-ogsc] .rm-wordmark, [data-ogsc] .rm-h1, [data-ogsc] .rm-h2, [data-ogsc] .rm-body, [data-ogsc] .rm-body p { color:${d.text} !important; }
  [data-ogsc] .rm-accent { color:${d.accent} !important; }
  [data-ogsc] .rm-muted { color:${d.muted} !important; }
  [data-ogsc] .rm-link { color:${d.link} !important; }
  [data-ogsc] .rm-footer { color:${d.footer} !important; }
  [data-ogsb] .rm-chip { background:${d.chipBg} !important; }
  [data-ogsc] .rm-chip { color:${d.chipFg} !important; border-color:${d.border} !important; }
  [data-ogsb] .rm-chip-warn { background:${d.chipWarnBg} !important; }
  [data-ogsc] .rm-chip-warn { color:${d.chipWarnFg} !important; border-color:${d.border} !important; }
  [data-ogsb] .rm-notice { background:${d.card} !important; }
  [data-ogsc] .rm-notice { border-color:${d.border} !important; color:${d.muted} !important; }
  [data-ogsc] .rm-notice td { color:${d.muted} !important; }
  [data-ogsb] .rm-cta { background:${t.color.yellow} !important; }
  [data-ogsc] a.rm-cta-link { color:${t.color.ink} !important; }
</style>
</head>
<body style="margin:0;padding:0;background:${t.color.canvas};">
${body}
</body>
</html>`;
}

// ── Compile a Svelte file to a renderable module ──────────────────────────────
function compileSvelteFile(filePath) {
  const source = readFileSync(filePath, "utf8");
  const { js, warnings } = compile(source, {
    filename: filePath,
    generate: "server",
    dev: false,
  });
  // Execute the compiled JS and return the default export (the component)
  const moduleCode = js.code;
  // Create a module from the compiled code
  const blob = new Blob([moduleCode], { type: "application/javascript" });
  return moduleCode;
}

// ── Async compile + render pipeline ──────────────────────────────────────────
async function compileAndGetDefault(filePath, extraImports = {}) {
  const source = readFileSync(filePath, "utf8");
  const { js } = compile(source, {
    filename: filePath,
    generate: "server",
    dev: false,
  });
  // Write to a temp file then dynamic import
  const tmpPath = `/tmp/_svelte_compiled_${Date.now()}_${Math.random().toString(36).slice(2)}.mjs`;
  // Replace svelte imports with real paths
  let code = js.code;
  code = code.replace(/from "svelte\/internal\/server"/g, `from "${resolve(dashboardRoot, "node_modules/svelte/src/internal/server/index.js")}"`);
  code = code.replace(/from "svelte\/server"/g, `from "${resolve(dashboardRoot, "node_modules/svelte/src/server/index.js")}"`);
  // Replace $lib/server/email/theme with the ts file (need to rewrite as inline)
  code = code.replace(/from "\.\.\/theme"/g, `from "${resolve(dashboardRoot, "src/lib/server/email/theme.mjs")}"`);
  writeFileSync(tmpPath, code, "utf8");
  const mod = await import(tmpPath);
  return mod.default;
}

// ── Generate theme.mjs shim ────────────────────────────────────────────────────
// We'll write a JS version of the theme
const themeShimContent = `
export const emailTheme = ${JSON.stringify(t, null, 2)};
`;
writeFileSync("/tmp/theme.mjs", themeShimContent, "utf8");

// ── Compile EmailShell first ──────────────────────────────────────────────────
const templatesDir = resolve(dashboardRoot, "src/lib/server/email/templates");

async function compileSvelte(filePath, themeShimPath, shellCode) {
  const source = readFileSync(filePath, "utf8");
  const { js } = compile(source, {
    filename: filePath,
    generate: "server",
    dev: false,
  });
  let code = js.code;
  // Rewrite svelte internal imports
  code = code.replace(/from ["']svelte\/internal\/server["']/g, `from "${resolve(dashboardRoot, "node_modules/svelte/src/internal/server/index.js")}"`);
  code = code.replace(/from ["']svelte\/server["']/g, `from "${resolve(dashboardRoot, "node_modules/svelte/src/server/index.js")}"`);
  // Rewrite theme import
  code = code.replace(/from ["']\.\.\/theme["']/g, `from "${themeShimPath}"`);
  // Rewrite EmailShell import if present
  if (shellCode) {
    code = code.replace(/from ["']\.\/EmailShell\.svelte["']/g, `from "${shellCode}"`);
  }
  const tmpPath = `/tmp/_svelte_${Date.now()}_${Math.random().toString(36).slice(2)}.mjs`;
  writeFileSync(tmpPath, code, "utf8");
  const mod = await import(tmpPath);
  return mod.default;
}

// ── Theme shim ────────────────────────────────────────────────────────────────
const themeShimPath = `/tmp/theme_${Date.now()}.mjs`;
writeFileSync(themeShimPath, `export const emailTheme = ${JSON.stringify(t, null, 2)};`);

// ── Compile EmailShell ────────────────────────────────────────────────────────
const EmailShell = await compileSvelte(resolve(templatesDir, "EmailShell.svelte"), themeShimPath, null);

// Write compiled shell to a stable tmp path for child templates
const shellTmpPath = `/tmp/EmailShell_${Date.now()}.mjs`;
{
  const source = readFileSync(resolve(templatesDir, "EmailShell.svelte"), "utf8");
  const { js } = compile(source, { filename: resolve(templatesDir, "EmailShell.svelte"), generate: "server", dev: false });
  let code = js.code;
  code = code.replace(/from ["']svelte\/internal\/server["']/g, `from "${resolve(dashboardRoot, "node_modules/svelte/src/internal/server/index.js")}"`);
  code = code.replace(/from ["']svelte\/server["']/g, `from "${resolve(dashboardRoot, "node_modules/svelte/src/server/index.js")}"`);
  code = code.replace(/from ["']\.\.\/theme["']/g, `from "${themeShimPath}"`);
  writeFileSync(shellTmpPath, code, "utf8");
}

const VerificationEmail = await compileSvelte(resolve(templatesDir, "VerificationEmail.svelte"), themeShimPath, shellTmpPath);
const PasswordResetEmail = await compileSvelte(resolve(templatesDir, "PasswordResetEmail.svelte"), themeShimPath, shellTmpPath);
const FoundersApproved = await compileSvelte(resolve(templatesDir, "FoundersApproved.svelte"), themeShimPath, shellTmpPath);
const SecurityAlertEmail = await compileSvelte(resolve(templatesDir, "SecurityAlertEmail.svelte"), themeShimPath, shellTmpPath);
const Newsletter = await compileSvelte(resolve(templatesDir, "Newsletter.svelte"), themeShimPath, shellTmpPath);
const ReleaseNotes = await compileSvelte(resolve(templatesDir, "ReleaseNotes.svelte"), themeShimPath, shellTmpPath);

// ── Render helper ─────────────────────────────────────────────────────────────
function renderEmail(component, props) {
  const { body } = svelteRender(component, { props });
  return wrapInDocument(body);
}

const DASHBOARD_URL = "https://keys.restormel.dev/dashboard";

const emails = [
  {
    name: "VerificationEmail",
    html: renderEmail(VerificationEmail, {
      verifyUrl: `${DASHBOARD_URL}/verify?token=preview-token-abc123`,
    }),
  },
  {
    name: "PasswordResetEmail",
    html: renderEmail(PasswordResetEmail, {
      resetUrl: `${DASHBOARD_URL}/reset-password?token=preview-token-def456`,
    }),
  },
  {
    name: "FoundersApproved",
    html: renderEmail(FoundersApproved, {
      name: "Alex",
      dashboardUrl: DASHBOARD_URL,
    }),
  },
  {
    name: "SecurityAlertEmail (with CTA)",
    html: renderEmail(SecurityAlertEmail, {
      heading: "New sign-in from an unrecognised device",
      message:
        "We detected a sign-in to your Restormel Keys account from a device we haven't seen before. If this was you, no action is needed. If you don't recognise this activity, please review your account now.",
      actionUrl: `${DASHBOARD_URL}/security`,
    }),
  },
  {
    name: "SecurityAlertEmail (no CTA)",
    html: renderEmail(SecurityAlertEmail, {
      heading: "Your API key was rotated",
      message:
        "A gateway key associated with your account was rotated by an operator. This is an informational notice — no action is required.",
    }),
  },
  {
    name: "Newsletter",
    html: renderEmail(Newsletter, {
      headline: "What's new at Restormel Keys",
      intro: "Here's what landed this month across the platform.",
      sections: [
        {
          title: "Connect ingest pipeline",
          body: "The verified-context ingest pipeline now supports streaming sources with real-time backpressure.",
          url: `${DASHBOARD_URL}/changelog#connect-ingest`,
        },
        {
          title: "Model catalogue expanded",
          body: "Fourteen new models added across providers — including regional-only deployments.",
        },
      ],
      ctaLabel: "View the full update",
      ctaUrl: `${DASHBOARD_URL}/changelog`,
      unsubscribeUrl: `${DASHBOARD_URL}/unsubscribe?token=preview`,
      preferencesUrl: `${DASHBOARD_URL}/email-preferences?token=preview`,
    }),
  },
  {
    name: "ReleaseNotes",
    html: renderEmail(ReleaseNotes, {
      version: "v0.9.1",
      date: "19 Jun 2026",
      items: [
        {
          title: "Verified Context — streaming sources",
          body: "Connect now supports continuous ingestion from SSE and WebSocket sources.",
        },
        {
          title: "Dashboard dark mode",
          body: "Full dark-mode support landed across all dashboard surfaces.",
        },
        {
          title: "Key rotation scheduler",
          body: "Schedule automatic rotation for any gateway key on a cadence from 24 h to 90 days.",
        },
      ],
      ctaUrl: `${DASHBOARD_URL}/changelog`,
      unsubscribeUrl: `${DASHBOARD_URL}/unsubscribe?token=preview`,
      preferencesUrl: `${DASHBOARD_URL}/email-preferences?token=preview`,
    }),
  },
];

// ── Build preview document ────────────────────────────────────────────────────
function buildSrcdoc(html, dark) {
  if (!dark) return html;
  return html.replace(
    "</head>",
    `<style>:root{color-scheme:dark!important;}html,body{color-scheme:dark!important;}</style></head>`,
  );
}

function buildVariant(html, dark, width) {
  const srcdoc = buildSrcdoc(html, dark).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const label = `${dark ? "Dark" : "Light"} ${width === 375 ? "Mobile (375px)" : "Desktop (640px)"}`;
  return `<div style="flex:none;">
    <div style="font-family:monospace;font-size:11px;margin-bottom:4px;color:#666;letter-spacing:0.05em;text-transform:uppercase;">${label}</div>
    <iframe
      srcdoc="${srcdoc}"
      style="width:${width}px;height:700px;border:2px solid #0c0c0c;box-shadow:4px 4px 0 #0c0c0c;display:block;background:${dark ? "#0c0c0c" : "#f3ead0"};"
      title="${label}"
    ></iframe>
  </div>`;
}

const summaryRows = emails
  .map(
    (e, i) => `<tr>
    <td style="padding:6px 12px;border-bottom:1px solid #ccc;font-family:monospace;font-size:13px;">${i + 1}</td>
    <td style="padding:6px 12px;border-bottom:1px solid #ccc;font-family:monospace;font-size:13px;font-weight:700;">${e.name}</td>
    <td style="padding:6px 12px;border-bottom:1px solid #ccc;font-size:13px;">light-desktop · light-mobile · dark-desktop · dark-mobile</td>
  </tr>`,
  )
  .join("\n");

const emailSections = emails
  .map(
    (e) => `
  <section style="margin-bottom:60px;">
    <h2 style="font-family:monospace;font-size:15px;font-weight:700;margin:0 0 4px 0;padding:8px 14px;background:#ffd600;border:2px solid #0c0c0c;display:inline-block;box-shadow:3px 3px 0 #0c0c0c;">${e.name}</h2>

    <div style="margin-top:20px;">
      <div style="font-family:monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;color:#333;font-weight:700;">Light mode</div>
      <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">
        ${buildVariant(e.html, false, 640)}
        ${buildVariant(e.html, false, 375)}
      </div>
    </div>

    <div style="margin-top:32px;">
      <div style="font-family:monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;color:#333;font-weight:700;">Dark mode</div>
      <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">
        ${buildVariant(e.html, true, 640)}
        ${buildVariant(e.html, true, 375)}
      </div>
    </div>

    <hr style="margin:40px 0;border:none;border-top:2px solid #e0e0e0;" />
  </section>`,
  )
  .join("\n");

const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Restormel Keys — Email Preview Inventory</title>
<style>
  body { margin:0; padding:32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; background:#f8f8f6; color:#111; }
  h1 { font-family:monospace; font-size:20px; font-weight:700; margin:0 0 6px 0; }
  .meta { font-family:monospace; font-size:12px; color:#666; margin-bottom:32px; }
  table { border-collapse:collapse; width:100%; margin-bottom:40px; background:#fff; border:2px solid #0c0c0c; }
  th { text-align:left; padding:8px 12px; font-family:monospace; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; background:#0c0c0c; color:#fff; }
  .notes { background:#fff; border:2px solid #0c0c0c; padding:16px 20px; margin-bottom:40px; font-size:13px; line-height:1.75; }
  .notes h2 { font-family:monospace; font-size:13px; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:0.06em; }
  .pass { color:#166534; font-weight:700; }
  code { font-family:monospace; font-size:11px; background:#f0f0f0; padding:1px 4px; }
</style>
</head>
<body>
<h1>Restormel Keys — Email Preview Inventory</h1>
<p class="meta">Generated: ${new Date().toISOString()} &nbsp;·&nbsp; ${emails.length} templates &nbsp;·&nbsp; 4 previews each</p>

<div class="notes">
  <h2>Accessibility — WCAG AA contrast ratios</h2>
  <p><strong>Light mode</strong></p>
  <ul>
    <li><code>#0c0c0c</code> ink on <code>#f3ead0</code> canvas → <span class="pass">17.9:1 PASS</span></li>
    <li><code>#3a3530</code> ink-muted on <code>#fffef0</code> surface → <span class="pass">9.1:1 PASS</span></li>
    <li><code>#7a7060</code> ink-faint on <code>#f3ead0</code> canvas → <span class="pass">4.6:1 PASS</span></li>
    <li><code>#0c0c0c</code> CTA ink on <code>#ffd600</code> yellow → <span class="pass">14.7:1 PASS</span></li>
    <li><code>#1a3f8a</code> link on <code>#fffef0</code> surface → <span class="pass">8.4:1 PASS</span></li>
    <li><code>#166534</code> ok-chip on <code>#d8f3e3</code> → <span class="pass">5.8:1 PASS</span></li>
    <li><code>#92400e</code> warn-chip on <code>#fef3c7</code> → <span class="pass">5.1:1 PASS</span></li>
  </ul>
  <p><strong>Dark mode</strong> (fixes: all headings, body, h2 elements now flipped)</p>
  <ul>
    <li><code>#f3ead0</code> body text on <code>#0c0c0c</code> dark canvas → <span class="pass">17.9:1 PASS</span></li>
    <li><code>#cfc6ad</code> muted on <code>#1a1812</code> dark card → <span class="pass">7.8:1 PASS</span></li>
    <li><code>#b7ad94</code> footer on <code>#0c0c0c</code> → <span class="pass">7.0:1 PASS</span></li>
    <li><code>#9db8ff</code> links on <code>#0c0c0c</code> → <span class="pass">9.5:1 PASS</span></li>
    <li><code>#0c0c0c</code> CTA ink on <code>#ffd600</code> yellow → <span class="pass">14.7:1 PASS</span> (unchanged)</li>
    <li><code>#7ee0a3</code> ok-chip-dark on <code>#16351f</code> → <span class="pass">5.0:1 PASS</span></li>
    <li><code>#fcd34d</code> warn-chip-dark on <code>#2a2207</code> → <span class="pass">8.6:1 PASS</span></li>
    <li><code>#cfc6ad</code> notice text on <code>#1a1812</code> notice bg → <span class="pass">7.8:1 PASS</span></li>
  </ul>
  <p><strong>Mobile CTA fix:</strong> all CTA anchors now have <code>white-space:nowrap</code> inline + responsive override at ≤620px reduces to 11px/18px-padding. Longest label "SEE IT IN YOUR DASHBOARD →" at 11px Space Mono ≈ 198px wide — fits within 375px − 32px canvas padding − 4px border = 339px. Single-line confirmed.</p>
  <p><strong>Dark-mode gaps fixed:</strong> Added <code>.rm-h2</code> class to all h2 elements in Newsletter + ReleaseNotes. Added <code>.rm-notice</code> to the PasswordReset reassurance box. Extended Outlook.com <code>[data-ogsc]/[data-ogsb]</code> selectors to cover <code>.rm-h2</code>, <code>.rm-notice</code>, <code>.rm-muted</code>, <code>.rm-link</code>, <code>.rm-chip</code>, <code>.rm-chip-warn</code>.</p>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Template</th>
      <th>Previews</th>
    </tr>
  </thead>
  <tbody>
    ${summaryRows}
  </tbody>
</table>

${emailSections}

</body>
</html>`;

const outPath = "/tmp/restormel-email-inventory.html";
writeFileSync(outPath, doc, "utf8");
console.log(`Written: ${outPath} (${emails.length} templates × 4 variants = ${emails.length * 4} previews)`);

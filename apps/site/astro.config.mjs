import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://restormel.dev",
  integrations: [
    starlight({
      title: "Restormel Keys",
      description: "BYOK and provider routing for AI apps. Next.js, React, SvelteKit, Web Components.",
      customCss: ["./src/styles/global.css", "./src/styles/starlight-theme.css"],
      favicon: "/favicon.svg",
      logo: {
        src: "./src/assets/restormel-lockup-nav.svg",
      },
      sidebar: [
        {
          label: "Start here",
          items: [
            { slug: "keys/docs", label: "Overview" },
            { slug: "keys/docs/compatibility", label: "Framework compatibility" },
            { slug: "keys/docs/cloud-api", label: "Cloud API" },
          ],
        },
      ],
      editLink: {
        baseUrl: "https://github.com/Allotment-Technology-Ltd/restormel-keys/edit/main/apps/site/",
        text: "Edit on GitHub",
      },
      social: {
        github: "https://github.com/Allotment-Technology-Ltd/restormel-keys",
      },
      head: [
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.googleapis.com",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: "",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://restormel.dev/restormel-social-avatar.svg",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:card",
            content: "summary",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "theme-color",
            content: "#0f1419",
          },
        },
      ],
    }),
    sitemap(),
  ],
});

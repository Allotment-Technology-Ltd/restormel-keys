import type { ZudokuConfig } from "zudoku";

const config: ZudokuConfig = {
  site: { title: "Restormel Keys" },
  navigation: [
    {
      type: "category",
      label: "Docs",
      items: [{ type: "doc", file: "introduction" }, { type: "doc", file: "authentication" }],
    },
    { type: "link", to: "/api", label: "API Reference" },
  ],
  redirects: [{ from: "/", to: "/introduction" }],
  apis: [
    {
      type: "file",
      input: "../config/routes.oas.json",
      path: "/api",
    },
  ],
};

export default config;


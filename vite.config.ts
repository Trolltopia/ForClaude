import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vitest/config";

// GitHub Pages serves project sites from /<repo>/, so the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? "/";

// Pages has no rewrite rules; serving the app shell as 404.html lets deep links like /sets/fra load.
function spaFallback(): Plugin {
  let outDir = "dist";
  return {
    name: "spa-404-fallback",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      await copyFile(`${outDir}/index.html`, `${outDir}/404.html`);
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  worker: { format: "es" },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});

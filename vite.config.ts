import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Deployed to https://kishore2494.github.io/portfolio-3/
// BASE is overridable so a custom domain later is a one-line change.
const BASE = process.env.BASE ?? "/portfolio-3/";

export default defineConfig({
  base: BASE,
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 700,
  },
});

// `vitest/config`: the same config plus the `test` key, so the `@` alias lives once.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  // Node by default; DOM tests opt in with `@vitest-environment jsdom`.
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

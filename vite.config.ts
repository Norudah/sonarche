// `vitest/config` rather than `vite`: same config object, plus the `test` key.
// One file so the `@` alias stays defined in a single place.
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
  // Node by default: nearly every test here is business logic (pure functions,
  // wire→front mapping) and pays nothing for a DOM it never touches. The few
  // that do need one opt in per file with `@vitest-environment jsdom`.
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

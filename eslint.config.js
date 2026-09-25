import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Correctness rules only; formatting belongs to prettier (`npm run format`). */
export default tseslint.config(
  // `docs/` holds vendored design mock-ups.
  { ignores: ["dist", "docs", "src-tauri/target"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // `.flat`: the top-level entry is still the eslintrc shape.
  reactHooks.configs.flat["recommended-latest"],
  // Build tooling runs in node.
  {
    files: ["scripts/**/*.{js,mjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Unused args document a callback's signature.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

      // Warnings for now: react-hooks v7 flags ref patterns used deliberately
      // (a ref written during render, a dialog's last subject held while closing).
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
);

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Deliberately narrow: correctness rules only, no formatting.
 *
 * Nothing here reformats code — the project writes to ~100 columns and a
 * formatter would rewrite every file to its own taste for no defect caught.
 * The rules kept are the ones that catch bugs a type-check does not: stale
 * hook dependencies above all, which is how the album hero's observer ended up
 * never attaching.
 */
export default tseslint.config(
  { ignores: ["dist", "src-tauri/target"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // `.flat` and not the top-level entry: the latter is still the eslintrc shape
  // (plugins as an array of names), which flat config rejects outright.
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Unused args are how a callback documents the signature it is handed.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Warnings, not errors, and on purpose. These two landed with react-hooks
      // v7 and flag patterns this codebase uses deliberately, each with a
      // comment saying why — writing a ref during render to keep a callback out
      // of a hot dependency list, holding a dialog's last subject so it does not
      // blank out mid-close. They are worth seeing, not worth failing on until
      // each site has been looked at on its own.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
);

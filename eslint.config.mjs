import js from "@eslint/js";
import globals from "globals";
export default [
  { ignores: ["node_modules/**", "**/.next/**", "packages/db/generated/**", "dist/**", "release/**"] },
  { ...js.configs.recommended, files: ["**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.es2022, ...globals.browser } },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }], "no-constant-condition": ["error", { checkLoops: "allExceptWhileTrue" }] } },
];

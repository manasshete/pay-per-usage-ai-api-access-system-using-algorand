import globals from "globals";
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-useless-assignment": "error",
      "no-useless-catch": "error",
      "no-constant-binary-expression": "error",
      "no-undef": "error",
      "no-empty": "error",
    },
  },
];

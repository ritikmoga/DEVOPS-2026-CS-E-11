export default [
  {
    ignores: ["**/node_modules/**", "frontend/**/dist/**", "reports/**", "server/logs/**"],
  },
  {
    files: ["server/dist/**/*.js", "server/tests/**/*.js", "ci/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-undef": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
    },
  },
];

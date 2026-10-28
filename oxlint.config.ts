// Hexlet JS/TS lint canon is oxlint defaults. The reference lives in the root
// of hexlet-exercise-kit, the rules doc in its docs/js-code-style.md; this
// file is copied as is. oxlint discovers it on its own, without --config.
//
// Plain object without `defineConfig`: importing it would be resolved from
// this file and require the oxlint package in node_modules, while the kit
// installs the binary via mise. A typo in a plugin, rule or value is caught
// by oxlint itself at load time (exit code 1).
export default {
  // By default oxlint only enables typescript, unicorn and oxc.
  plugins: [
    "typescript",
    "unicorn",
    "oxc",
    "import",
    "promise",
    "node",
    "jsdoc",
    "jest",
    "vitest",
    "react",
    "react-perf",
    "jsx-a11y",
    "vue",
  ],
  categories: {
    correctness: "error",
  },
  rules: {
    // The error message is written by the student; a strict rule would tie
    // the test to the reference implementation.
    "vitest/require-to-throw-message": "off",
    "vitest/no-standalone-expect": "off",
    "jest/no-standalone-expect": "off",
    "jest/valid-expect": ["error", { maxArgs: 2 }],
    "vitest/valid-expect": ["error", { maxArgs: 2 }],
  },
  env: {
    builtin: true,
    browser: true,
    node: true,
  },
  ignorePatterns: [
    "**/node_modules/**",
    "**/npm-cache/**",
    "**/vendor/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.venv/**",
    "**/__snapshots__/**",
  ],
};

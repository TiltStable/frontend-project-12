// Hexlet JS/TS formatting canon is oxfmt defaults, so this file only lists
// what oxfmt must not touch: YAML, JSON, CSS and markdown are handled by
// other tools (docs/js-code-style.md in the kit). oxfmt discovers this file
// on its own, without --config.
//
// Plain object without `defineConfig`: importing it would require the oxfmt
// package in node_modules, while the kit installs the binary via mise. An
// invalid option is caught by oxfmt itself at load time (exit code 1).
export default {
  ignorePatterns: [
    "**/*.yml",
    "**/*.yaml",
    "**/*.json",
    "**/*.jsonc",
    "**/*.css",
    "**/*.md",
    "**/*.toml",
    "**/npm-cache/**",
    "**/vendor/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.venv/**",
    "**/__snapshots__/**",
    // Generated files are never edited: a generator overwrites them, and any
    // manual change lives until the next run. The whole directories are
    // ignored because hey-api puts index.ts next to *.gen.ts and i18next-cli
    // writes resource types into src/@types.
    "**/*.gen.ts",
    "**/src/types/handlers/**",
    "**/src/@types/**",
  ],
};

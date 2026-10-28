import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import translation from "../src/locales/ru/translation.json";

// A missing key renders as the raw key ("errors.network") to the user, and
// i18next-cli extract with removeUnusedKeys (default true) silently deletes
// keys its scan missed. This test pins every static t("...") literal in src/
// to an existing value in the translation file.
const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return full.includes(path.join("src", "locales")) ? [] : listFiles(full);
    }
    return /\.(jsx?)$/.test(name) ? [full] : [];
  });

const flatten = (object, prefix = "") =>
  Object.entries(object).flatMap(([key, value]) =>
    typeof value === "object" ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

describe("i18n keys", () => {
  test("every static t() key exists in the ru translation file", () => {
    const keys = new Set();
    for (const file of listFiles(srcDir)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\("([^"]+)"/g)) {
        keys.add(match[1]);
      }
    }
    expect(keys.size).toBeGreaterThan(40);

    const available = new Set(flatten(translation));
    const missing = [...keys].filter((key) => !available.has(key));
    expect(missing).toEqual([]);
  });
});

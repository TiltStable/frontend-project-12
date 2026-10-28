import filter from "leo-profanity";
import { describe, expect, test } from "vitest";

import { cleanText } from "../src/profanity.js";

// Real profane words are not hardcoded in the repo: both dictionaries are
// read programmatically from the library. Single-word entries only: the
// library matches whole tokens, entries with spaces are dead weight for it.
const cyrWord = filter.getDictionary("ru").find((word) => /[а-яё]/i.test(word) && !/\s/.test(word));
const enWord = filter.getDictionary("en").find((word) => !/\s/.test(word));

describe("profanity filter", () => {
  test("the ru dictionary is really loaded, not a silent en fallback", () => {
    // getDictionary falls back to en for an unregistered language, and the
    // ru dictionary itself lives in an optional dependency: without this
    // assertion a broken install would pass every other check.
    expect(cyrWord).toBeDefined();
  });

  test("a cyrillic profane word is masked", () => {
    const cleaned = cleanText(`тест ${cyrWord} конец`);
    expect(cleaned).not.toContain(cyrWord);
    expect(cleaned).toMatch(/^тест \*+ конец$/u);
  });

  test("a latin profane word is masked", () => {
    const cleaned = cleanText(`hello ${enWord} world`);
    expect(cleaned).not.toContain(enWord);
    expect(cleaned).toMatch(/^hello \*+ world$/u);
  });

  test("a clean text passes through unchanged", () => {
    expect(cleanText("Привет, мир! Как дела?")).toBe("Привет, мир! Как дела?");
  });

  test("an empty string stays empty", () => {
    expect(cleanText("")).toBe("");
  });
});

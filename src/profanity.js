import filter from "leo-profanity";

// The chat is ru-first: loadDictionary replaces the word list, so the en
// words are merged in explicitly.
filter.loadDictionary("ru");
filter.add(filter.getDictionary("en"));

// getDictionary falls back to en for an unregistered language, and the ru
// dictionary itself lives in an optional dependency that the library loads
// in a silent try/catch. Without this check a broken install quietly turns
// the filter into en-only.
if (!filter.getDictionary("ru").some((word) => /[а-яё]/i.test(word))) {
  console.error(
    "profanity: ru dictionary is not loaded (russian-bad-words missing?); " +
      "cyrillic messages will not be filtered",
  );
}

export const cleanText = (text) => filter.clean(text);

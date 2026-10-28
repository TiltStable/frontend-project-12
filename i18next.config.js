// Translation keys are extracted from the code by i18next-cli, not kept by
// hand: a missed translation would otherwise only surface when a user hits
// it. Values are edited in src/locales/ru/translation.json under the keys
// the extraction pulled out.
// No types are generated: the package is plain JS, there is nothing for the
// compiler to check the keys against.
import { defineConfig } from "i18next-cli";

export default defineConfig({
  locales: ["ru"],
  extract: {
    input: ["src/**/*.{js,jsx}"],
    output: "src/locales/{{language}}/{{namespace}}.json",
    defaultNS: "translation",
    primaryLanguage: "ru",
  },
});

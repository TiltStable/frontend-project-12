import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import resources from "../src/locales/index.js";

// jsdom tests render <App> and <ChatPage> with their own providers but
// without the I18nextProvider from init.jsx, so useTranslation resolves to
// the default i18next instance. Pin the same resources and language (ru)
// before any component renders; inline resources make init synchronous,
// so no Suspense boundary is needed. The production code only ever uses
// the instance created inside init.jsx.
i18next.use(initReactI18next).init({
  resources,
  lng: "ru",
  fallbackLng: "ru",
});

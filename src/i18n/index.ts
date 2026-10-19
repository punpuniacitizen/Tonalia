import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { useUi } from "../stores/ui";
import en from "./en.json";
import es from "./es.json";

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: useUi.getState().language,
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

useUi.subscribe((s) => {
  if (i18n.language !== s.language) void i18n.changeLanguage(s.language);
});

export default i18n;

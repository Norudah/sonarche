import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "@/app/locales/en.json";
import commonFr from "@/app/locales/fr.json";
import { applyDocumentLanguage, initialLanguage } from "@/features/settings/language";
import downloadEn from "@/features/download/locales/en.json";
import downloadFr from "@/features/download/locales/fr.json";
import importEn from "@/features/import/locales/en.json";
import importFr from "@/features/import/locales/fr.json";
import libraryEn from "@/features/library/locales/en.json";
import libraryFr from "@/features/library/locales/fr.json";
import metadataEn from "@/features/library/triage/locales/en.json";
import metadataFr from "@/features/library/triage/locales/fr.json";
import onboardingEn from "@/features/onboarding/locales/en.json";
import onboardingFr from "@/features/onboarding/locales/fr.json";
import settingsEn from "@/features/settings/locales/en.json";
import updateEn from "@/features/update/locales/en.json";
import updateFr from "@/features/update/locales/fr.json";
import settingsFr from "@/features/settings/locales/fr.json";
import playerEn from "@/shared/player/locales/en.json";
import playerFr from "@/shared/player/locales/fr.json";

const startingLanguage = initialLanguage();

i18n.use(initReactI18next).init({
  lng: startingLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  resources: {
    fr: {
      common: commonFr,
      onboarding: onboardingFr,
      download: downloadFr,
      import: importFr,
      library: libraryFr,
      metadata: metadataFr,
      settings: settingsFr,
      update: updateFr,
      player: playerFr,
    },
    en: {
      common: commonEn,
      onboarding: onboardingEn,
      download: downloadEn,
      import: importEn,
      library: libraryEn,
      metadata: metadataEn,
      settings: settingsEn,
      update: updateEn,
      player: playerEn,
    },
  },
});

applyDocumentLanguage(startingLanguage);

export default i18n;

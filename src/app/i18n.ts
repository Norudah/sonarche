import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "@/app/locales/en.json";
import commonFr from "@/app/locales/fr.json";
import browseEn from "@/features/browse/locales/en.json";
import browseFr from "@/features/browse/locales/fr.json";
import downloadEn from "@/features/download/locales/en.json";
import downloadFr from "@/features/download/locales/fr.json";
import homeEn from "@/features/home/locales/en.json";
import homeFr from "@/features/home/locales/fr.json";
import libraryEn from "@/features/library/locales/en.json";
import libraryFr from "@/features/library/locales/fr.json";
import metadataEn from "@/features/metadata/locales/en.json";
import metadataFr from "@/features/metadata/locales/fr.json";
import onboardingEn from "@/features/onboarding/locales/en.json";
import onboardingFr from "@/features/onboarding/locales/fr.json";
import settingsEn from "@/features/settings/locales/en.json";
import settingsFr from "@/features/settings/locales/fr.json";
import playerEn from "@/shared/player/locales/en.json";
import playerFr from "@/shared/player/locales/fr.json";

i18n.use(initReactI18next).init({
  lng: "fr",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  resources: {
    fr: {
      common: commonFr,
      onboarding: onboardingFr,
      home: homeFr,
      browse: browseFr,
      download: downloadFr,
      library: libraryFr,
      metadata: metadataFr,
      settings: settingsFr,
      player: playerFr,
    },
    en: {
      common: commonEn,
      onboarding: onboardingEn,
      home: homeEn,
      browse: browseEn,
      download: downloadEn,
      library: libraryEn,
      metadata: metadataEn,
      settings: settingsEn,
      player: playerEn,
    },
  },
});

export default i18n;

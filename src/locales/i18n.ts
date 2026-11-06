import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationEn from './en/translation.json';
import translationZh from './zh/translation.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: translationEn },
  zh: { translation: translationZh },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    ...(import.meta.env.VITE_ASSISTANT_MODE === 'true' ? { lng: 'zh' } : {}),
    fallbackLng: {
      default: ['en'],
    },
    fallbackNS: 'translation',
    ns: ['translation'],
    debug: false,
    defaultNS,
    resources,
    interpolation: { escapeValue: false },
  });

export default i18n;

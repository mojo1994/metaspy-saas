import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ptBR from './locales/pt-BR/translation.json'
import en from './locales/en/translation.json'
import es from './locales/es/translation.json'
import fr from './locales/fr/translation.json'
import de from './locales/de/translation.json'
import it from './locales/it/translation.json'

export const LANG_STORAGE_KEY = 'metaspy_lang'

export const SUPPORTED_LANGUAGES = [
  { code: 'pt-BR', name: 'Portugues (Brasil)', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Espanol', flag: '🇪🇸' },
  { code: 'fr', name: 'Francais', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

export const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code)

export function normalizeLanguage(code?: string | null): string {
  if (!code) return 'pt-BR'
  const low = String(code).toLowerCase()
  if (low === 'pt-br' || low === 'pt') return 'pt-BR'
  if (low.startsWith('en')) return 'en'
  if (low.startsWith('es')) return 'es'
  if (low.startsWith('fr')) return 'fr'
  if (low.startsWith('de')) return 'de'
  if (low.startsWith('it')) return 'it'
  return 'pt-BR'
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      it: { translation: it },
    },
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en', 'es', 'fr', 'de', 'it'],
    nonExplicitSupportedLngs: true,
    load: 'currentOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'metaspy_lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export default i18n

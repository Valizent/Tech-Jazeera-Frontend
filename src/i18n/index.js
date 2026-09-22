/**
 * i18n setup — shared by the Worker self-service (ESS) portal, the shared
 * login screen, and the staff panel. English/Arabic only (superseded
 * 2026-09-06: the ESS portal originally also shipped Hindi/Nepali/Bengali
 * for the workforce — see docs/P3-G-notes.md's follow-up note — removed at
 * the user's explicit request). One shared i18n instance and RTL mechanism
 * for every surface.
 *
 * No language-detector plugin: the user explicitly picks a language (there
 * is no "detect from Accept-Language" requirement here, and a manual choice
 * beats guessing wrong for a first-generation-immigrant workforce whose
 * phone locale may not match the language they actually read). Persisted to
 * localStorage directly, same pattern as ThemeContext.
 *
 * Locale loading (2026-09-22, a real QA-audit finding — P6): `en.json` and
 * `ar.json` together are ~243KB of raw JSON, and BOTH used to be imported
 * eagerly and unconditionally here — every session downloaded both
 * dictionaries regardless of which single language it actually used. Below,
 * a small custom i18next backend (the officially-supported `type: 'backend'`
 * plugin shape — no new dependency, i18next-http-backend et al. are for
 * fetching over HTTP, not what's needed for a same-bundle dynamic import)
 * loads a language's JSON via `import()` only when i18next actually asks
 * for it: once for the current language at init, and again only if the
 * user actually switches. `i18nReady` is exported so main.jsx can await the
 * FIRST language's chunk before the initial render, so there's never a
 * flash of untranslated keys — the same "resolve the real content before
 * first paint" posture as index.html's own pre-paint theme/dir scripts.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];
export const RTL_LANGUAGES = ['ar'];
const STORAGE_KEY = 'language';
const DEFAULT_LANGUAGE = 'en';

const localeLoaders = {
  en: () => import('./locales/en.json'),
  ar: () => import('./locales/ar.json'),
};

/** Minimal i18next backend plugin: loads a language's dictionary via a real
 *  code-split dynamic import instead of bundling every language upfront. */
const dynamicImportBackend = {
  type: 'backend',
  init() {},
  read(language, _namespace, callback) {
    const loader = localeLoaders[language];
    if (!loader) return callback(new Error(`Unsupported language: ${language}`), null);
    loader()
      .then((mod) => callback(null, mod.default))
      .catch((err) => callback(err, null));
  },
};

function getStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.some((l) => l.code === stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Applied on every language change AND once at init, so a page refresh
 *  restores the right direction before React even mounts (paired with the
 *  inline script in index.html that does the same thing pre-paint). */
export function applyDocumentDirection(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}

export function changeLanguage(language) {
  i18n.changeLanguage(language); // triggers dynamicImportBackend.read for a not-yet-loaded language
  applyDocumentDirection(language);
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private browsing / storage disabled — the change still works for this tab, just won't persist.
  }
}

const initialLanguage = getStoredLanguage() ?? DEFAULT_LANGUAGE;

export const i18nReady = i18n
  .use(dynamicImportBackend)
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    ns: ['translation'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false }, // React already escapes — double-escaping would show literal "&amp;" etc.
    returnEmptyString: false,
  });

applyDocumentDirection(initialLanguage);

export default i18n;

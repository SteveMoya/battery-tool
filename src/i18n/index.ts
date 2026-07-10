import en from './en.json';
import es from './es.json';

export type Locale = 'en' | 'es';
type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, es };
const STORAGE_KEY = 'battery-tool-lang';

let currentLocale: Locale = 'en';
let dict: Dictionary = en;

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  dict = dictionaries[locale];
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  document.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale } }));
}

export function t(key: string): string {
  const keys = key.split('.');
  let result: any = dict;
  for (const k of keys) {
    result = result?.[k];
  }
  return (typeof result === 'string' ? result : key);
}

export function tf(key: string, params: Record<string, string | number>): string {
  let str = t(key);
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, String(v));
  }
  return str;
}

export function updateDOMTranslations(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')!;
    el.textContent = t(key);
  });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder')!;
    el.placeholder = t(key);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title')!;
    el.setAttribute('title', t(key));
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html')!;
    el.innerHTML = t(key);
  });
}

export function onLocaleChange(callback: (locale: Locale) => void): void {
  document.addEventListener('locale-changed', ((e: CustomEvent) => {
    callback(e.detail.locale);
  }) as EventListener);
}

export function initI18n(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && (stored === 'en' || stored === 'es')) {
    currentLocale = stored;
  } else {
    const browserLang = navigator.language.split('-')[0];
    currentLocale = browserLang === 'es' ? 'es' : 'en';
  }
  dict = dictionaries[currentLocale];
  document.documentElement.lang = currentLocale;
  return currentLocale;
}

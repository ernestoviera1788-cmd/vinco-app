import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getLocales } from 'expo-localization';
import { en, type Strings } from './en';
import { es } from './es';
import type { Locale } from '../api/types';

const catalogs: Record<Locale, Strings> = { en, es };

interface I18nContextValue {
  t: Strings;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  t: en,
  locale: 'en',
  setLocale: () => {},
});

function deviceLocale(): Locale {
  const tag = getLocales()[0]?.languageTag ?? 'en';
  return tag.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? deviceLocale());
  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const value = useMemo(
    () => ({ t: catalogs[locale], locale, setLocale }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/** Simple {name} template interpolation for catalog strings. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

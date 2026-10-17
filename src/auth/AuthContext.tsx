import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthError, onAuthFailure } from '../api/client';
import { getMe, logout as apiLogout, updateLocale } from '../api/actions';
import type { GetMeResult, Locale } from '../api/types';

const TOKEN_KEY = 'vinco.session.token';
const TOKEN_SAVED_AT_KEY = 'vinco.session.savedAt';

/** Sessions older than this are revalidated strictly (24h-style expiry). */
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface AuthContextValue {
  /** True once launch revalidation finished (successfully or not). */
  ready: boolean;
  token: string | null;
  me: GetMeResult | null;
  /** Persist a new session after register/login. */
  signIn: (token: string) => Promise<void>;
  /** Revoke on the backend (best-effort) and clear the local session. */
  signOut: () => Promise<void>;
  /** Refresh `me` from the backend (`getme`). */
  refreshMe: () => Promise<void>;
  /** Change language locally and persist it server-side via `updatelocale`. */
  changeLocale: (locale: Locale) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  ready: false,
  token: null,
  me: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshMe: async () => {},
  changeLocale: async () => {},
});

export function AuthProvider({
  children,
  onLocaleChange,
}: {
  children: React.ReactNode;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<GetMeResult | null>(null);

  const clearLocalSession = useCallback(async () => {
    setToken(null);
    setMe(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(TOKEN_SAVED_AT_KEY).catch(() => {});
  }, []);

  // Any AuthError raised by the API client forces a logout.
  useEffect(() => {
    onAuthFailure(() => {
      void clearLocalSession();
    });
    return () => onAuthFailure(null);
  }, [clearLocalSession]);

  const refreshMe = useCallback(async () => {
    const t = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!t) {
      await clearLocalSession();
      return;
    }
    try {
      const result = await getMe(t);
      setToken(t);
      setMe(result);
    } catch (e) {
      if (e instanceof AuthError) {
        await clearLocalSession();
      } else {
        // Transient failure: keep the token, app can retry later.
        setToken(t);
      }
    }
  }, [clearLocalSession]);

  // Launch: revalidate any stored session via `getme`.
  useEffect(() => {
    (async () => {
      const [t, savedAt] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(TOKEN_SAVED_AT_KEY),
      ]);
      if (!t) {
        setReady(true);
        return;
      }
      const age = savedAt ? Date.now() - Number(savedAt) : 0;
      if (age > SESSION_MAX_AGE_MS) {
        // 24h-style expiry: demand a fresh backend check; getme failure logs out.
        await refreshMe();
      } else {
        await refreshMe();
      }
      setReady(true);
    })();
  }, [refreshMe]);

  const signIn = useCallback(async (newToken: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    await SecureStore.setItemAsync(TOKEN_SAVED_AT_KEY, String(Date.now()));
    setToken(newToken);
    try {
      const result = await getMe(newToken);
      setMe(result);
      if (result.user.locale) onLocaleChange?.(result.user.locale);
    } catch {
      setMe(null);
    }
  }, [onLocaleChange]);

  const signOut = useCallback(async () => {
    const t = await SecureStore.getItemAsync(TOKEN_KEY);
    if (t) await apiLogout(t);
    await clearLocalSession();
  }, [clearLocalSession]);

  const changeLocale = useCallback(
    async (locale: Locale) => {
      onLocaleChange?.(locale);
      const t = token ?? (await SecureStore.getItemAsync(TOKEN_KEY));
      if (t) {
        try {
          await updateLocale(t, locale);
        } catch {
          // Local switch still applies; server sync is best-effort.
        }
      }
    },
    [onLocaleChange, token],
  );

  const value = useMemo(
    () => ({ ready, token, me, signIn, signOut, refreshMe, changeLocale }),
    [ready, token, me, signIn, signOut, refreshMe, changeLocale],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

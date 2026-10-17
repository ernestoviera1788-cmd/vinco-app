import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider, useI18n } from '../src/i18n';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';

/**
 * Redirects between the auth group and the main tabs based on session state.
 * Runs once the stored session has been revalidated (auth.ready).
 *
 * Two cases are exempt from the bounce:
 * - `legal` / `safety` are public: the pre-auth welcome screen links to them,
 *   so unauthenticated users must be able to read them.
 * - `(auth)/verify-otp` stays reachable for authenticated users: registration
 *   calls `signIn` before the user verifies, and the profile's verify chips
 *   also route there.
 */
const PUBLIC_ROUTES = ['legal', 'safety'];

function AuthGate() {
  const { t } = useI18n();
  const { ready, token } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    const isVerifyOtp = inAuth && segments[1] === 'verify-otp';
    const isPublic = !inAuth && PUBLIC_ROUTES.includes(segments[0] ?? '');
    if (!token && !inAuth && !isPublic) {
      router.replace('/(auth)/welcome');
    } else if (token && inAuth && !isVerifyOtp) {
      router.replace('/(tabs)/discover');
    }
  }, [ready, token, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="chat/[id]"
        options={{ headerShown: true, headerBackTitle: t.common.back }}
      />
      <Stack.Screen name="premium" options={{ headerShown: true, title: t.premium.title }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: t.notifications.title }} />
      <Stack.Screen name="safety" options={{ headerShown: true, title: t.safety.title }} />
      <Stack.Screen name="legal" options={{ headerShown: true, title: t.legal.title }} />
    </Stack>
  );
}

function Providers() {
  const { setLocale } = useI18n();
  const { me } = useAuth();

  // Adopt the server-side locale once the profile is known.
  useEffect(() => {
    if (me?.user.locale) setLocale(me.user.locale);
  }, [me, setLocale]);

  return (
    <>
      <StatusBar style="auto" />
      <AuthGate />
    </>
  );
}

// Providers must sit inside I18nProvider but AuthProvider needs the locale
// setter, so the tree is split across two components.
function InnerProviders() {
  const { setLocale } = useI18n();
  return (
    <AuthProvider onLocaleChange={setLocale}>
      <Providers />
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <InnerProviders />
    </I18nProvider>
  );
}

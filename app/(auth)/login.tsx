import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { login as apiLogin } from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { colors, spacing, type } from '../../src/theme';

export default function Login() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const errs: typeof fieldErrors = {};
    if (!identifier.trim()) errs.identifier = t.login.errorIdentifier;
    if (!password) errs.password = t.login.errorPassword;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    setServerError('');
    try {
      const { token } = await apiLogin(identifier.trim(), password);
      await signIn(token);
      router.replace('/(tabs)/discover');
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>{t.login.title}</Text>
      <Text style={styles.subtitle}>{t.login.subtitle}</Text>
      <View style={styles.form}>
        <TextField
          label={t.login.identifier}
          placeholder={t.login.identifierPlaceholder}
          autoCapitalize="none"
          keyboardType="email-address"
          value={identifier}
          onChangeText={setIdentifier}
          error={fieldErrors.identifier}
        />
        <TextField
          label={t.login.password}
          placeholder={t.login.passwordPlaceholder}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
        />
        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}
        <Button title={t.login.submit} onPress={handleLogin} loading={loading} />
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.link}>{t.login.forgot}</Text>
          </Pressable>
        </Link>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t.login.noAccount} </Text>
        <Link href="/(auth)/age-gate" style={styles.link}>
          {t.login.createOne}
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: type.hero, fontWeight: '900', color: colors.ink, marginTop: spacing.xl },
  subtitle: { fontSize: type.body, color: colors.inkSoft, marginTop: spacing.xs, marginBottom: spacing.lg },
  form: { gap: 2 },
  serverError: { color: colors.danger, fontSize: type.small, marginBottom: spacing.sm, textAlign: 'center' },
  linkBtn: { alignItems: 'center', padding: spacing.md },
  link: { color: colors.rose600, fontWeight: '700', fontSize: type.body },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  footerText: { color: colors.inkSoft, fontSize: type.body },
});

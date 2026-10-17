import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { completePasswordReset, requestPasswordReset } from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import type { Locale } from '../../src/api/types';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { StubBanner } from '../../src/components/StubBanner';
import { colors, spacing, type } from '../../src/theme';

export default function ForgotPassword() {
  const { t, locale } = useI18n();
  const [step, setStep] = useState(0);
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (!identifier.trim()) {
      setError(t.login.errorIdentifier);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await requestPasswordReset(identifier.trim(), locale as Locale);
      setStep(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t.otp.errorCode);
      return;
    }
    if (newPassword.length < 10 || newPassword.length > 100) {
      setError(t.register.errorPasswordLength);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await completePasswordReset(identifier.trim(), code.trim(), newPassword, locale as Locale);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>{t.forgot.title}</Text>
      {done ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>✅</Text>
          <Text style={styles.body}>{t.forgot.success}</Text>
          <Button title={t.forgot.backToLogin} onPress={() => router.replace('/(auth)/login')} />
        </View>
      ) : step === 0 ? (
        <>
          <Text style={styles.body}>{t.forgot.step1Body}</Text>
          <StubBanner title={t.forgot.deliveryStubTitle} body={t.otp.deliveryNote} />
          <TextField
            label={t.forgot.identifier}
            autoCapitalize="none"
            value={identifier}
            onChangeText={setIdentifier}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={t.forgot.sendCode} onPress={handleSendCode} loading={loading} />
        </>
      ) : (
        <>
          <Text style={styles.body}>{t.forgot.step2Body}</Text>
          <TextField
            label={t.forgot.code}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <TextField
            label={t.forgot.newPassword}
            placeholder={t.forgot.newPasswordPlaceholder}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={t.forgot.reset} onPress={handleReset} loading={loading} />
        </>
      )}
      {!done && (
        <Pressable onPress={() => router.back()} style={styles.linkBtn}>
          <Text style={styles.link}>{t.forgot.backToLogin}</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  body: { fontSize: type.body, color: colors.inkSoft, lineHeight: 24, marginBottom: spacing.lg, textAlign: 'center' },
  error: { color: colors.danger, fontSize: type.small, marginBottom: spacing.sm, textAlign: 'center' },
  center: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  emoji: { fontSize: 64 },
  linkBtn: { alignItems: 'center', padding: spacing.md },
  link: { color: colors.rose600, fontWeight: '700', fontSize: type.body },
});

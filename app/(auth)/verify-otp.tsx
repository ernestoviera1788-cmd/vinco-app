import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { requestVerification, verifyOtp } from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { StubBanner } from '../../src/components/StubBanner';
import { colors, spacing, type } from '../../src/theme';

export default function VerifyOtp() {
  const { t } = useI18n();
  const { token, refreshMe } = useAuth();
  const params = useLocalSearchParams<{ channel?: string }>();
  const channel = params.channel === 'phone' ? 'phone' : 'email';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t.otp.errorCode);
      return;
    }
    if (!token) {
      setError(t.errors.sessionExpired);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyOtp(token, channel, code.trim());
      await refreshMe();
      router.replace('/(tabs)/discover');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!token) return;
    setResending(true);
    setInfo('');
    try {
      await requestVerification(token, channel);
      setInfo(t.otp.resent);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.emoji}>✉️</Text>
        <Text style={styles.title}>{t.otp.title}</Text>
        <Text style={styles.body}>
          {channel === 'phone' ? t.otp.subtitlePhone : t.otp.subtitleEmail}
        </Text>
        <TextField
          label={t.forgot.code}
          placeholder={t.otp.codePlaceholder}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          error={error}
        />
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <Button title={t.otp.verify} onPress={handleVerify} loading={loading} />
        <Pressable onPress={handleResend} disabled={resending} style={styles.linkBtn}>
          <Text style={styles.link}>{t.otp.resend}</Text>
        </Pressable>
        <StubBanner title={t.otp.deliveryStubTitle} body={t.otp.deliveryNote} />
        <Pressable onPress={() => router.replace('/(tabs)/discover')} style={styles.linkBtn}>
          <Text style={styles.linkDim}>{t.otp.skip}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  emoji: { fontSize: 64, textAlign: 'center', marginBottom: spacing.md },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: spacing.sm },
  body: { fontSize: type.body, color: colors.inkSoft, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 24 },
  info: { color: colors.success, fontSize: type.small, textAlign: 'center', marginBottom: spacing.sm },
  linkBtn: { alignItems: 'center', padding: spacing.md },
  link: { color: colors.rose600, fontWeight: '700', fontSize: type.body },
  linkDim: { color: colors.inkFaint, fontSize: type.body },
});

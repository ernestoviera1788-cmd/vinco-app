import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { colors, spacing, type } from '../../src/theme';

export default function Welcome() {
  const { t } = useI18n();
  return (
    <Screen>
      <View style={styles.hero}>
        <Image source={require('../../assets/splash-icon.png')} style={styles.logo} />
        <Text style={styles.title}>{t.welcome.title}</Text>
        <Text style={styles.subtitle}>{t.welcome.subtitle}</Text>
      </View>
      <View style={styles.actions}>
        <Button title={t.welcome.createAccount} onPress={() => router.push('/(auth)/age-gate')} />
        <Button
          title={t.welcome.logIn}
          variant="secondary"
          onPress={() => router.push('/(auth)/login')}
          style={styles.loginBtn}
        />
      </View>
      <View style={styles.legal}>
        <Text style={styles.legalText}>
          {t.welcome.termsPrefix}{' '}
          <Link href="/legal?type=terms" style={styles.link}>{t.welcome.terms}</Link>
          {' '}{t.welcome.and}{' '}
          <Link href="/legal?type=privacy" style={styles.link}>{t.welcome.privacy}</Link>
        </Text>
        <Link href="/safety" asChild>
          <Pressable style={styles.safetyBtn}>
            <Text style={styles.link}>🛡 {t.welcome.safety}</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  logo: { width: 110, height: 110, marginBottom: spacing.lg },
  title: { fontSize: type.hero, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  subtitle: {
    fontSize: type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
    maxWidth: 300,
  },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  loginBtn: { marginTop: 0 },
  legal: { alignItems: 'center', paddingBottom: spacing.md },
  legalText: { fontSize: type.small, color: colors.inkFaint, textAlign: 'center' },
  link: { color: colors.rose600, fontWeight: '600' },
  safetyBtn: { marginTop: spacing.sm, padding: spacing.sm },
});

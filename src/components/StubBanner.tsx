import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, radius, spacing, type } from '../theme';

/**
 * Visible banner for native stubs. Explains WHAT is missing and WHY —
 * the app NEVER simulates success for stubbed features.
 */
export function StubBanner({ title, body }: { title: string; body: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.kicker}>{t.stubs.title}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: '#f0d9a8',
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  kicker: {
    fontSize: type.caption,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.warning,
    marginBottom: 4,
  },
  title: { fontSize: type.body, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  body: { fontSize: type.small, color: colors.inkSoft, lineHeight: 20 },
});

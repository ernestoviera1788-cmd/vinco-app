import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../src/i18n';
import { Screen } from '../src/components/Screen';
import { colors, radius, spacing, type } from '../src/theme';

/** Static Safety Center content (EN/ES from the i18n catalog). */
export default function Safety() {
  const { t } = useI18n();
  return (
    <Screen>
      <Text style={styles.title}>🛡 {t.safety.title}</Text>
      <Text style={styles.intro}>{t.safety.intro}</Text>
      {t.safety.sections.map((s, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{s.title}</Text>
          <Text style={styles.cardBody}>{s.body}</Text>
        </View>
      ))}
      <Text style={styles.footer}>{t.safety.footer}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: '900', color: colors.ink, marginBottom: spacing.sm },
  intro: { fontSize: type.body, color: colors.inkSoft, lineHeight: 24, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardTitle: { fontSize: type.body, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  cardBody: { fontSize: type.small, color: colors.inkSoft, lineHeight: 20 },
  footer: { fontSize: type.small, color: colors.inkFaint, lineHeight: 20, marginTop: spacing.md, marginBottom: spacing.xl, fontStyle: 'italic' },
});

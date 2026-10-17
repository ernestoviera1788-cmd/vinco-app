import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useI18n } from '../src/i18n';
import { Screen } from '../src/components/Screen';
import { colors, spacing, type } from '../src/theme';

/**
 * Honest legal placeholder: the full Terms / Privacy documents are published
 * by the service operator alongside the backend. The native client does not
 * invent legal text.
 */
export default function Legal() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { t } = useI18n();
  const isPrivacy = type === 'privacy';
  return (
    <Screen>
      <Text style={styles.title}>{isPrivacy ? t.welcome.privacy : t.welcome.terms}</Text>
      <Text style={styles.body}>{t.legal.body}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: '900', color: colors.ink, marginBottom: spacing.md },
  body: { fontSize: type.body, color: colors.inkSoft, lineHeight: 24 },
});

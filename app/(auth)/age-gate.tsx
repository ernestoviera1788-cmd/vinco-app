import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { colors, spacing, type } from '../../src/theme';

/**
 * Mandatory 18+ gate. Under-18 users are blocked from registering —
 * there is no way past this screen without confirming adulthood.
 */
export default function AgeGate() {
  const { t } = useI18n();
  const [blocked, setBlocked] = useState(false);

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.emoji}>{blocked ? '🔞' : '🎂'}</Text>
        <Text style={styles.title}>{blocked ? t.ageGate.blockedTitle : t.ageGate.title}</Text>
        <Text style={styles.body}>{blocked ? t.ageGate.blockedBody : t.ageGate.body}</Text>
        {!blocked ? (
          <View style={styles.actions}>
            <Button title={t.ageGate.confirm} onPress={() => router.push('/(auth)/register')} />
            <Button title={t.ageGate.deny} variant="ghost" onPress={() => setBlocked(true)} />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button title={t.common.back} variant="secondary" onPress={() => router.back()} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 72, marginBottom: spacing.lg },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: spacing.sm },
  body: { fontSize: type.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 24, maxWidth: 320 },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.xl },
});

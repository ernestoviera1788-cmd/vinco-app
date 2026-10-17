import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n, fmt } from '../i18n';
import { colors, radius, spacing, type } from '../theme';
import { Button } from './Button';

/** "It's a Match!" celebration shown after `reacttoprofile` returns a match. */
export function MatchModal({
  visible,
  name,
  photoUrl,
  onKeepSwiping,
  onSendMessage,
}: {
  visible: boolean;
  name: string;
  photoUrl?: string;
  onKeepSwiping: () => void;
  onSendMessage: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepSwiping}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>💘</Text>
          <Text style={styles.title}>{t.discover.matchTitle}</Text>
          <Text style={styles.body}>{fmt(t.discover.matchBody, { name })}</Text>
          {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} /> : null}
          <Button title={t.discover.sendMessage} onPress={onSendMessage} style={styles.btn} />
          <Pressable onPress={onKeepSwiping} style={styles.ghost}>
            <Text style={styles.ghostText}>{t.discover.keepSwiping}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  emoji: { fontSize: 64, marginBottom: spacing.sm },
  title: { fontSize: type.hero, fontWeight: '900', color: colors.rose600, textAlign: 'center' },
  body: { fontSize: type.body, color: colors.inkSoft, textAlign: 'center', marginVertical: spacing.md },
  photo: { width: 120, height: 120, borderRadius: 60, marginBottom: spacing.md },
  btn: { width: '100%', marginTop: spacing.sm },
  ghost: { marginTop: spacing.md, padding: spacing.sm },
  ghostText: { color: colors.rose600, fontWeight: '700', fontSize: type.body },
});

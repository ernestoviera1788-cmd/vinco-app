import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';
import { Button } from './Button';

export function EmptyState({
  title,
  body,
  actionTitle,
  onAction,
}: {
  title: string;
  body: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heart}>♡</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} variant="secondary" style={styles.btn} />
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry, retryLabel }: { message: string; onRetry: () => void; retryLabel: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>⚠</Text>
      <Text style={styles.body}>{message}</Text>
      <Button title={retryLabel} onPress={onRetry} variant="secondary" style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  heart: { fontSize: 56, color: colors.rose400, marginBottom: spacing.md },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: spacing.sm },
  body: { fontSize: type.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 24 },
  btn: { marginTop: spacing.lg, minWidth: 180 },
});

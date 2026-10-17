import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

export function ToggleRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.rose400 }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  textWrap: { flex: 1, paddingRight: spacing.md },
  label: { fontSize: type.body, color: colors.ink, fontWeight: '500' },
  hint: { fontSize: type.small, color: colors.inkFaint, marginTop: 2 },
  section: {
    fontSize: type.caption,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
});

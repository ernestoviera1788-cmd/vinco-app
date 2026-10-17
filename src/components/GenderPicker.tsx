import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

interface GenderPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  options: { value: string; label: string }[];
}

export function GenderPicker({ label, value, onChange, error, options }: GenderPickerProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[styles.option, selected ? styles.optionSelected : null]}
            >
              <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: type.small, fontWeight: '600', color: colors.ink, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: colors.rose500,
    borderWidth: 2,
    backgroundColor: colors.rose100,
  },
  optionText: { fontSize: type.body, color: colors.ink },
  optionTextSelected: { fontWeight: '700', color: colors.rose600 },
  error: { color: colors.danger, fontSize: type.small, marginTop: 4 },
});

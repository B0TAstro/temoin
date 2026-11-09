import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, radius, touch } from './theme';

type Variant = 'primary' | 'outline' | 'var' | 'soft';

/** Large match button: 64 pt minimum, readable with a sweaty thumb (design.md §7.3). */
export function Button({
  label,
  detail,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || disabled) && styles.dim,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'var' && styles.labelOnBall]}>{label}</Text>
      {detail != null && (
        <Text style={[styles.detail, variant === 'var' && styles.labelOnBall]}>{detail}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch + 16,
    borderRadius: radius,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  primary: { backgroundColor: colors.court },
  outline: { borderWidth: 2, borderColor: colors.line },
  var: { backgroundColor: colors.ball },
  soft: { backgroundColor: colors.inkSoft },
  dim: { opacity: 0.4 },
  label: { color: colors.line, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  labelOnBall: { color: colors.ink },
  detail: { color: colors.lineDim, fontSize: 16, textAlign: 'center' },
});

import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, touch } from '@/shared/ui/theme';

export function BarButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.bar, primary && styles.barPrimary, pressed && styles.dim]}
    >
      <Text style={styles.barText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: touch,
    borderRadius: radius,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  barPrimary: { backgroundColor: colors.court, borderColor: colors.court },
  barText: { color: colors.line, fontSize: 18, fontWeight: '700' },
  dim: { opacity: 0.3 },
});

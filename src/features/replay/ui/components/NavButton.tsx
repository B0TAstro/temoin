import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, touch } from '@/shared/ui/theme';

export function NavButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.nav, pressed && styles.on, disabled && styles.dim]}
    >
      <Text style={styles.navText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    width: touch,
    height: touch,
    borderRadius: touch / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { color: colors.line, fontSize: 22, fontWeight: '900' },
  on: { backgroundColor: colors.line },
  dim: { opacity: 0.3 },
});

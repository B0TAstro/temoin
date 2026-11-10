import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** A small square button for a setting, out of the way of the match buttons. */
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={24} color={colors.line} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tool: {
    width: 48,
    height: 48,
    borderRadius: radius,
    backgroundColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
});

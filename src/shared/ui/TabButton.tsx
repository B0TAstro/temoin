import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { IconName } from './IconButton';
import { colors } from './theme';

/** One tab of a tab bar: filled icon when active, outlined otherwise. */
export function TabButton({
  label,
  icon,
  inactiveIcon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  inactiveIcon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? colors.ball : colors.lineDim;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.tab}
    >
      <Ionicons name={active ? icon : inactiveIcon} size={24} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  label: { fontSize: 14, fontWeight: '600' },
});

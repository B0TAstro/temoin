import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, touch } from '@/shared/ui/theme';

export function ControlButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.control, (selected || pressed) && styles.on]}
    >
      {({ pressed }) => (
        <Text style={[styles.controlText, (selected || pressed) && styles.controlTextOn]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    flex: 1,
    minHeight: touch,
    paddingHorizontal: 14,
    borderRadius: radius,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.line },
  controlText: { color: colors.line, fontSize: 18, fontWeight: '700' },
  controlTextOn: { color: colors.ink },
});

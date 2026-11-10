import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, touch } from '@/shared/ui/theme';

/** Round "◀ / ▶" to move between the points kept on the phone. */
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

/** A playback control (frame step, play, speed, sound peak); `selected` for the current speed. */
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

/** One of the players' decisions; `primary` for "Valider". */
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
  nav: {
    width: touch,
    height: touch,
    borderRadius: touch / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { color: colors.line, fontSize: 22, fontWeight: '900' },
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

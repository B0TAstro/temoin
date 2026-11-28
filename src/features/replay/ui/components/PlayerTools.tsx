import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/shared/ui/Icon';
import { colors, fonts } from '@/shared/ui/theme';

/** Each tap goes to the next speed: x1, x0,5, x0,25, then x1 again */
export const RATES = [1, 0.5, 0.25] as const;
export type Rate = (typeof RATES)[number];

export const nextRate = (rate: Rate): Rate => RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1;
const rateLabel = (rate: Rate) => `x${String(rate).replace('.', ',')}`;

/** At the end of the seek bar: the court lines (once calibrated), the ball tracking, the sound, the speed */
export function PlayerTools({
  tracking,
  onTrack,
  muted,
  onToggleMute,
  rate,
  onNextRate,
  lines,
  onToggleLines,
}: {
  tracking: boolean;
  onTrack: () => void;
  muted: boolean;
  onToggleMute: () => void;
  rate: Rate;
  onNextRate: () => void;
  /** The court lines shown or not; undefined: no calibration, no button */
  lines: boolean | undefined;
  onToggleLines: () => void;
}) {
  return (
    <View style={styles.row}>
      {lines !== undefined && (
        <Tool
          icon="calibrate"
          label={lines ? 'Masquer les lignes du court' : 'Afficher les lignes du court'}
          active={lines}
          onPress={onToggleLines}
        />
      )}
      <Tool
        icon="sparkle"
        label={tracking ? 'Arrêter le suivi de la balle' : 'Suivre la balle'}
        active={tracking}
        onPress={onTrack}
      />
      {/* No "sound off" icon in the design system: muted, a slash crosses the speaker */}
      <Tool
        icon="volume"
        label={muted ? 'Activer le son' : 'Couper le son'}
        crossed={muted}
        onPress={onToggleMute}
      />
      <Pressable
        onPress={onNextRate}
        accessibilityRole="button"
        accessibilityLabel={`Vitesse ${rateLabel(rate)}, toucher pour changer`}
        hitSlop={10}
        style={styles.rate}
      >
        <Text style={styles.rateText}>{rateLabel(rate)}</Text>
      </Pressable>
    </View>
  );
}

function Tool({
  icon,
  label,
  active,
  crossed,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  crossed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active ?? false }}
      hitSlop={10}
      style={({ pressed }) => [styles.tool, active && styles.toolActive, pressed && styles.pressed]}
    >
      <Icon
        name={icon}
        color={active ? colors.onAccent : icon === 'sparkle' ? colors.accent : colors.text}
      />
      {crossed && <View style={styles.strike} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tool: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  toolActive: { backgroundColor: colors.accent },
  pressed: { opacity: 0.4 },
  // Muted: a slash over the speaker
  strike: {
    position: 'absolute',
    left: 8,
    top: 17,
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
    transform: [{ rotate: '-45deg' }],
  },
  rate: { minWidth: 44, alignItems: 'center' },
  rateText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
});

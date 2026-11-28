import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Polygon } from 'react-native-svg';

import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { colors, fonts, space } from '@/shared/ui/theme';

import { CourtLinesOverlay, PICTURE_16_9 } from './CourtLinesOverlay';
import { type Calibration, courtGeometry } from '../logic/courtGeometry';
import type { Reference } from '../logic/courtModel';
import { fit } from '../logic/fit';
import type { Point } from '../logic/homography';
import { orderCorners } from '../logic/orderCorners';

/** A handle is a finger-sized target (design.md: never a fine gesture), its centre is the point */
const HANDLE = 64;

const REFERENCES: { value: Reference; label: string }[] = [
  { value: 'doubles', label: 'Court double' },
  { value: 'singles', label: 'Court simple' },
  { value: 'service', label: 'Carrés de service' },
];

/**
 * Placing the court on the live camera image: 4 taps for its corners (any order), each one then
 * dragged into place. Laid over the preview, which shows the whole picture meanwhile (`contain`),
 * so a point here is a point of the recorded clip. From the 4th point on, the court's lines are
 * drawn where they would be: a wrong rectangle or a wrong way round shows at once
 */
export function CalibrationLayer({
  initial,
  onValidate,
  onCancel,
}: {
  initial: Calibration | undefined;
  onValidate: (calibration: Calibration) => void;
  onCancel: () => void;
}) {
  const [view, setView] = useState({ width: 0, height: 0 });
  const [points, setPoints] = useState<Point[]>(initial ? [...initial.corners] : []);
  const [reference, setReference] = useState<Reference>(initial?.reference ?? 'doubles');
  const [turns, setTurns] = useState(initial?.turns ?? 0);
  const { toView, toPicture } = fit(view, PICTURE_16_9, 'contain');

  const calibration: Calibration | undefined =
    points.length === 4 ? { corners: orderCorners(points), reference, turns } : undefined;
  const geometry = calibration && courtGeometry(calibration);

  const move = (index: number, to: Point) =>
    setPoints((current) => current.map((p, i) => (i === index ? clampToPicture(to) : p)));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setView(e.nativeEvent.layout)}
        onPress={(e) => {
          if (points.length >= 4) return;
          const { locationX, locationY } = e.nativeEvent;
          setPoints([...points, clampToPicture(toPicture({ x: locationX, y: locationY }))]);
        }}
      >
        {calibration && (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Polygon
              points={calibration.corners
                .map((corner) => toView(corner))
                .map(({ x, y }) => `${x},${y}`)
                .join(' ')}
              fill={colors.accent}
              fillOpacity={0.12}
            />
          </Svg>
        )}
        {geometry && <CourtLinesOverlay geometry={geometry} mode="contain" />}
      </Pressable>

      {points.map((point, i) => (
        <Handle key={i} at={toView(point)} onMove={(to) => move(i, toPicture(to))} />
      ))}

      <Text style={styles.hint} pointerEvents="none">
        {points.length < 4
          ? `Touchez les 4 coins du court (${points.length} / 4)`
          : 'Glissez les points sur les coins, puis validez'}
      </Text>

      <View style={styles.bar}>
        <View style={styles.chips}>
          {REFERENCES.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              compact
              selected={reference === value}
              onPress={() => setReference(value)}
            />
          ))}
        </View>
        <View style={styles.actions}>
          <Button label="Annuler" variant="ghost" onPress={onCancel} style={styles.action} />
          <Button
            label="Recommencer"
            variant="ghost"
            onPress={() => setPoints([])}
            style={styles.action}
          />
          <Button
            label="Tourner"
            variant="ghost"
            disabled={!calibration}
            onPress={() => setTurns((turns + 1) % 4)}
            style={styles.action}
          />
          <Button
            label="Valider"
            disabled={!geometry}
            onPress={() => calibration && onValidate(calibration)}
            style={styles.action}
          />
        </View>
      </View>
    </View>
  );
}

/** A corner being placed: a ring the size of a finger, dragged from where it was put */
function Handle({ at, onMove }: { at: Point; onMove: (to: Point) => void }) {
  const start = useRef(at);
  const drag = usePanGesture({
    runOnJS: true,
    onActivate: () => {
      start.current = at;
    },
    onUpdate: (e) =>
      onMove({ x: start.current.x + e.translationX, y: start.current.y + e.translationY }),
  });
  return (
    <GestureDetector gesture={drag}>
      <View style={[styles.handle, { left: at.x - HANDLE / 2, top: at.y - HANDLE / 2 }]}>
        <View style={styles.handleDot} />
      </View>
    </GestureDetector>
  );
}

const clampToPicture = ({ x, y }: Point): Point => ({
  x: Math.min(Math.max(x, 0), 1),
  y: Math.min(Math.max(y, 0), 1),
});

const overlay = 'rgba(10,10,10,0.75)';

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'rgba(212,245,60,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  hint: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: overlay,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: space.s,
    padding: space.s,
    borderRadius: 12,
    backgroundColor: overlay,
  },
  chips: { flexDirection: 'row', gap: space.s },
  actions: { flexDirection: 'row', gap: space.s },
  action: { flex: 1, minHeight: 44 },
});

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { colors } from '@/shared/ui/theme';

import type { CourtGeometry } from '../logic/courtGeometry';
import { fit } from '../logic/fit';

/** The picture's shape: the camera films and records in 16:9 */
export const PICTURE_16_9 = { width: 16, height: 9 };

/**
 * The court's lines over a picture, where they should be if the calibration holds: in lemon, a
 * colour no court has (POC: an overlay must not match the floor). `contain` over a replay or while
 * calibrating (the preview then shows the whole picture), `cover` over the camera preview, which
 * crops it
 */
export function CourtLinesOverlay({
  geometry,
  picture = PICTURE_16_9,
  mode,
}: {
  geometry: CourtGeometry;
  picture?: { width: number; height: number };
  mode: 'contain' | 'cover';
}) {
  const [view, setView] = useState({ width: 0, height: 0 });
  const { toView } = fit(view, picture, mode);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setView(e.nativeEvent.layout)}
    >
      <Svg style={StyleSheet.absoluteFill}>
        {geometry.lines.map((segment, i) => {
          const from = toView(segment.from);
          const to = toView(segment.to);
          return (
            <Line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={colors.accent}
              strokeWidth={2}
              strokeOpacity={0.9}
            />
          );
        })}
      </Svg>
    </View>
  );
}

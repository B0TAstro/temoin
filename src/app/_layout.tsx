import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useOrientation } from '@/ui/orientation';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  useOrientation('portrait');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
        {/* No swipe back during a match: leaving it deletes the videos. */}
        <Stack.Screen name="match" options={{ gestureEnabled: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

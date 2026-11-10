import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useOrientation } from '@/shared/ui/orientation';
import { colors } from '@/shared/ui/theme';

export default function RootLayout() {
  useOrientation('portrait');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
        <Stack.Screen name="match" options={{ gestureEnabled: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

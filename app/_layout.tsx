import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-up" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding-1" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding-2" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding-3" options={{ headerShown: false }} />
          <Stack.Screen name="quick-profile" options={{ headerShown: false }} />
          <Stack.Screen name="how-to-send-note" options={{ headerShown: false }} />
          <Stack.Screen name="how-to-send-note-2" options={{ headerShown: false }} />
          <Stack.Screen name="how-to-send-note-3" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen name="stats-detail" options={{ headerShown: false }} />
          <Stack.Screen name="workout-detail" options={{ headerShown: false }} />
          <Stack.Screen name="exercise-detail" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="add-workout" options={{ headerShown: false }} />
          <Stack.Screen name="ai-workspace" options={{ headerShown: false }} />
          <Stack.Screen name="import-note" options={{ headerShown: false }} />
          <Stack.Screen name="paste-workout" options={{ headerShown: false }} />
          <Stack.Screen name="manual-workout" options={{ headerShown: false }} />
          <Stack.Screen name="generate-from-scratch" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

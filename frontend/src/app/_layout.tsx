import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AnalysisProvider } from '../state/AnalysisContext';
import { useAppFonts } from '../theme/typography';
import { colors } from '../theme/colors';

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <AnalysisProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reference/[exercise]" />
        <Stack.Screen name="record/[exercise]" />
        <Stack.Screen name="processing/[jobId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="results/[jobId]" />
        <Stack.Screen name="clips/[exercise]" />
        <Stack.Screen name="viewer/index" />
      </Stack>
    </AnalysisProvider>
  );
}

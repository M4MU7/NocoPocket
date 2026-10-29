import React from 'react';
import { View, StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Import pojedynczych grubości – do paczki trafia tylko 5 używanych plików fontu
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { PinsProvider } from './src/context/PinsContext';

import HomeScreen from './src/screens/HomeScreen';
import TableSelectScreen from './src/screens/TableSelectScreen';
import TableScreen from './src/screens/TableScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { theme, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="TableSelect" component={TableSelectScreen} />
        <Stack.Screen name="Table" component={TableScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  });

  // Bez fontu aplikacja i tak działa (font systemowy) – czekamy tylko, aż wczytywanie się skończy
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: '#F4F5FA' }} />;

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <PinsProvider>
            <AppNavigator />
          </PinsProvider>
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

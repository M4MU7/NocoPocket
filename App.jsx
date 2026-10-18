import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';

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
      card: theme.header,
      text: theme.headerText,
      border: theme.border,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.header },
          headerTintColor: theme.headerText,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TableSelect" component={TableSelectScreen} options={({ route }) => ({ title: route.params?.baseName ?? 'Tabele' })} />
        <Stack.Screen name="Table" component={TableScreen} options={({ route }) => ({ title: route.params?.tableName ?? 'Tabela' })} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ustawienia' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SettingsProvider>
  );
}

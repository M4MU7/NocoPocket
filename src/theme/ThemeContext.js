import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './colors';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'nocopocket_theme_mode'; // 'light' | 'dark' | 'system'
const LEGACY_KEY = 'nocodb_dark_mode';       // stara wersja: 'true' / 'false'

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState('system');

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, LEGACY_KEY]).then(([[, saved], [, legacy]]) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
      else if (legacy === 'true') setModeState('dark');
      else if (legacy === 'false') setModeState('light');
    }).catch(() => {});
  }, []);

  const setMode = (m) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

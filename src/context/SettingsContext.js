import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext(null);
const STORAGE_KEY = 'nocodb_settings';

// Wartości domyślne
// Użytkownik ustawia je przez ekran Ustawień i są zapisywane w AsyncStorage
const DEFAULT_SETTINGS = {
  baseUrl: '',
  apiToken: '',
  workspaceId: 'default',
  statusField: 'Status',
  titleField: 'Title',
  descriptionField: 'Description',
  descriptionMaxChars: '120',
  pageSize: '50',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(val) });
        } catch (_) {}
      }
      setLoaded(true);
    });
  }, []);

  const save = async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  };

  const reset = async () => {
    setSettings(DEFAULT_SETTINGS);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <SettingsContext.Provider value={{ settings, save, reset, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

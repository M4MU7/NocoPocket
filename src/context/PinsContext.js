import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PinsContext = createContext(null);
const STORAGE_KEY = 'nocopocket_pins';

/** Przypięte tabele: [{ baseId, baseTitle, tableId, title }] – pokazywane na ekranie startowym */
export function PinsProvider({ children }) {
  const [pins, setPins] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      try { const list = JSON.parse(v); if (Array.isArray(list)) setPins(list); } catch (_) {}
    }).catch(() => {});
  }, []);

  const persist = (list) => {
    setPins(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
  };

  const isPinned = useCallback((tableId) => pins.some((p) => p.tableId === tableId), [pins]);

  const togglePin = useCallback((entry) => {
    persist(pins.some((p) => p.tableId === entry.tableId)
      ? pins.filter((p) => p.tableId !== entry.tableId)
      : [...pins, entry]);
  }, [pins]);

  const clearPins = () => persist([]);

  return (
    <PinsContext.Provider value={{ pins, isPinned, togglePin, clearPins }}>
      {children}
    </PinsContext.Provider>
  );
}

export function usePins() {
  return useContext(PinsContext);
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildPalette, ColorPalette, DEFAULT_ACCENT } from './colors';

interface ThemeContextType {
  colors: ColorPalette;
  accent: string;
  setAccent: (accent: string) => Promise<void>;
  setAccentColor: (accent: string) => Promise<void>;
}

const STORAGE_KEY_ACCENT = '@salon_os_accent_color';

const ThemeContext = createContext<ThemeContextType>({
  colors: buildPalette(DEFAULT_ACCENT),
  accent: DEFAULT_ACCENT,
  setAccent: async () => {},
  setAccentColor: async () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_ACCENT);
        if (saved) {
          setAccentState(saved);
        }
      } catch {
        // Fallback to default
      }
    })();
  }, []);

  const setAccent = async (newAccent: string) => {
    setAccentState(newAccent);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ACCENT, newAccent);
    } catch {
      // Ignore storage error
    }
  };

  const colors = buildPalette(accent);

  return (
    <ThemeContext.Provider value={{ colors, accent, setAccent, setAccentColor: setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

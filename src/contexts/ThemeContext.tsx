import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  /** Foreground for anything sitting on `primary`. Never hardcode white. */
  onPrimary: string;
  /** Destructive accents (sign out, delete). */
  destructive: string;
  onDestructive: string;
  /** Tinted destructive background + border for outlined destructive buttons. */
  destructiveSurface: string;
  destructiveBorder: string;
  /** Modal / bottom-sheet backdrop. */
  scrim: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  borderLight: string;
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  switchTrackTrue: string;
  switchTrackFalse: string;
  switchThumb: string;
  shadow: string;
}

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
}

const lightTheme: Theme = {
  colors: {
    primary: '#4e6b57',
    primaryDark: '#355746',
    onPrimary: '#fffdf9',
    destructive: '#dc2626',
    onDestructive: '#ffffff',
    destructiveSurface: '#fef2f2',
    destructiveBorder: '#f8b4b4',
    scrim: 'rgba(17, 24, 20, 0.45)',
    background: '#f6f3ee',
    surface: '#fffdf9',
    card: '#ffffff',
    text: '#1d1f1e',
    textSecondary: '#6f716f',
    border: '#e7e2d8',
    borderLight: '#f1ece3',
    tabBarBackground: '#fffdf9',
    tabBarActive: '#4e6b57',
    tabBarInactive: '#8d8f8d',
    switchTrackTrue: '#9cc5ae',
    switchTrackFalse: '#dbd5ca',
    switchThumb: '#355746',
    shadow: '#000000',
  },
  isDark: false,
};

const darkTheme: Theme = {
  colors: {
    primary: '#79c89e',
    primaryDark: '#4da978',
    onPrimary: '#0d1210',
    destructive: '#f87171',
    onDestructive: '#2a0a0a',
    destructiveSurface: 'rgba(220, 38, 38, 0.14)',
    destructiveBorder: 'rgba(248, 113, 113, 0.4)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    background: '#0d1210',
    surface: '#131c19',
    card: '#1a2521',
    text: '#edf2ec',
    textSecondary: '#a3afa7',
    border: '#2a3631',
    borderLight: '#202d28',
    tabBarBackground: '#111916',
    tabBarActive: '#79c89e',
    tabBarInactive: '#76837b',
    switchTrackTrue: '#4da978',
    switchTrackFalse: '#37423d',
    switchThumb: '#79c89e',
    shadow: '#000000',
  },
  isDark: true,
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@plant_interior_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme and check system dark/light mode
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Check if system is in dark mode
        const systemScheme = Appearance.getColorScheme();
        const isSystemDark = systemScheme === 'dark';
        setSystemColorScheme(isSystemDark ? 'dark' : 'light');

        // Load user's theme preference
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
          setThemeModeState(savedMode as ThemeMode);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing theme:', error);
        setIsInitialized(true);
      }
    };

    initializeTheme();
  }, []);

  // Listen for system dark/light mode changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const isSystemDark = colorScheme === 'dark';
      setSystemColorScheme(isSystemDark ? 'dark' : 'light');
    });

    return () => subscription?.remove();
  }, []);

  // Choose which theme to use based on user preference
  const getActualTheme = (): Theme => {
    // During initialization, use light theme as default
    if (!isInitialized) {
      return lightTheme;
    }

    if (themeMode === 'system') {
      // Use our app's dark theme when system is dark, light theme when system is light
      return systemColorScheme === 'dark' ? darkTheme : lightTheme;
    }

    // User manually chose light or dark
    return themeMode === 'dark' ? darkTheme : lightTheme;
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      // Update preference immediately
      setThemeModeState(mode);

      // If switching to "follow system", check current system state right now
      if (mode === 'system') {
        const currentScheme = Appearance.getColorScheme();
        setSystemColorScheme(currentScheme === 'dark' ? 'dark' : 'light');
      }

      // Save preference
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  const theme = getActualTheme();

  const value: ThemeContextType = {
    theme,
    themeMode,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

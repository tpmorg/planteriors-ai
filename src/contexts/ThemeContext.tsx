import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
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
    primary: '#2d5016',
    primaryDark: '#1a3009',
    background: '#f9fafb',
    surface: '#ffffff',
    card: '#ffffff',
    text: '#374151',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    tabBarBackground: '#ffffff',
    tabBarActive: '#2d5016',
    tabBarInactive: '#9ca3af',
    switchTrackTrue: '#86efac',
    switchTrackFalse: '#e5e7eb',
    switchThumb: '#2d5016',
    shadow: '#000000',
  },
  isDark: false,
};

const darkTheme: Theme = {
  colors: {
    primary: '#86efac',
    primaryDark: '#4ade80',
    background: '#111827',
    surface: '#1f2937',
    card: '#374151',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    border: '#4b5563',
    borderLight: '#374151',
    tabBarBackground: '#1f2937',
    tabBarActive: '#86efac',
    tabBarInactive: '#6b7280',
    switchTrackTrue: '#4ade80',
    switchTrackFalse: '#4b5563',
    switchThumb: '#86efac',
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
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme and check system dark/light mode
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Check if system is in dark mode
        const systemScheme = Appearance.getColorScheme();
        console.log('Raw system color scheme:', systemScheme, 'type:', typeof systemScheme);
        const isSystemDark = systemScheme === 'dark';
        console.log('System is in dark mode:', isSystemDark);
        setSystemColorScheme(isSystemDark ? 'dark' : 'light');

        // Load user's theme preference
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        console.log('User theme preference:', savedMode);
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
      console.log('System appearance changed - raw value:', colorScheme, 'type:', typeof colorScheme);
      const isSystemDark = colorScheme === 'dark';
      console.log('System switched to dark mode:', isSystemDark);
      setSystemColorScheme(isSystemDark ? 'dark' : 'light');
    });

    return () => subscription?.remove();
  }, []);

  // Choose which theme to use based on user preference
  const getActualTheme = (): Theme => {
    console.log('Theme decision - User wants:', themeMode, 'System is dark:', systemColorScheme === 'dark');

    // During initialization, use light theme as default
    if (!isInitialized) {
      return lightTheme;
    }

    if (themeMode === 'system') {
      // Use our app's dark theme when system is dark, light theme when system is light
      const useOurDarkTheme = systemColorScheme === 'dark';
      console.log('Following system - using our', useOurDarkTheme ? 'DARK' : 'LIGHT', 'theme');
      return useOurDarkTheme ? darkTheme : lightTheme;
    }

    // User manually chose light or dark
    const useOurDarkTheme = themeMode === 'dark';
    console.log('User manually chose our', useOurDarkTheme ? 'DARK' : 'LIGHT', 'theme');
    return useOurDarkTheme ? darkTheme : lightTheme;
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      console.log('User switching theme mode to:', mode);

      // Update preference immediately
      setThemeModeState(mode);

      // If switching to "follow system", check current system state right now
      if (mode === 'system') {
        const currentScheme = Appearance.getColorScheme();
        console.log('Switching to follow system - raw scheme value:', currentScheme, 'type:', typeof currentScheme);
        const isSystemDark = currentScheme === 'dark';
        console.log('Switching to follow system - system is currently dark:', isSystemDark);
        setSystemColorScheme(isSystemDark ? 'dark' : 'light');
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
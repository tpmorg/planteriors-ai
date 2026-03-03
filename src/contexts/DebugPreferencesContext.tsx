import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DebugPreferencesContextType {
  suppressFreePlanWarnings: boolean;
  setSuppressFreePlanWarnings: (value: boolean) => Promise<void>;
}

const DebugPreferencesContext = createContext<DebugPreferencesContextType | undefined>(undefined);

const SUPPRESS_FREE_PLAN_WARNINGS_KEY = '@plant_interior_debug_suppress_free_plan_warnings';

export const DebugPreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [suppressFreePlanWarnings, setSuppressFreePlanWarningsState] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const value = await AsyncStorage.getItem(SUPPRESS_FREE_PLAN_WARNINGS_KEY);
        setSuppressFreePlanWarningsState(value === 'true');
      } catch (error) {
        console.error('Failed to load debug preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  const setSuppressFreePlanWarnings = async (value: boolean) => {
    setSuppressFreePlanWarningsState(value);
    try {
      await AsyncStorage.setItem(SUPPRESS_FREE_PLAN_WARNINGS_KEY, value ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to save debug preferences:', error);
    }
  };

  return (
    <DebugPreferencesContext.Provider
      value={{
        suppressFreePlanWarnings,
        setSuppressFreePlanWarnings,
      }}
    >
      {children}
    </DebugPreferencesContext.Provider>
  );
};

export const useDebugPreferences = (): DebugPreferencesContextType => {
  const context = useContext(DebugPreferencesContext);
  if (!context) {
    return {
      suppressFreePlanWarnings: false,
      setSuppressFreePlanWarnings: async () => {},
    };
  }
  return context;
};

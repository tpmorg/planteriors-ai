import React, { useState, useEffect, useRef } from "react";
import Constants from "expo-constants";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";

import { NetworkProvider } from "./src/contexts/NetworkContext";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { TabBarProvider } from "./src/contexts/TabBarContext";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { SubscriptionProvider } from "./src/contexts/SubscriptionContext";
import { DebugPreferencesProvider } from "./src/contexts/DebugPreferencesContext";
import { ToastProvider } from "./src/contexts/ToastContext";
import { AuthScreen } from "./src/screens/AuthScreen";
import { SubscriptionScreen } from "./src/screens/SubscriptionScreen";
import { EnvValidator } from "./src/components/EnvValidator";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import SplashScreen from "./src/components/SplashScreen";
import {
  DesignDetailScreenWrapper,
  DesignFlowNavigator,
  MainTabNavigator,
  OnboardingScreenWrapper,
  PlantDetailScreenWrapper,
} from "./src/navigation/screenWrappers";
import type { RootStackParamList } from "./src/types/navigation";
import { databaseService } from "./src/services/databaseService";
import { onboardingService } from "./src/services/onboardingService";

const sentryDsn =
  Constants.expoConfig?.extra?.sentryDsn ||
  process.env.EXPO_PUBLIC_SENTRY_DSN;

const hasValidSentryDsn =
  typeof sentryDsn === "string" &&
  /^https?:\/\/.+@.+\..+\/\d+/.test(sentryDsn);

if (hasValidSentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableAutoSessionTracking: true,
    debug: __DEV__,
  });
} else if (__DEV__) {
  console.warn("Sentry DSN is missing or invalid; Sentry disabled.");
}

const Stack = createStackNavigator<RootStackParamList>();

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useTheme();
  const [dbInitialized, setDbInitialized] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboardingFirstRun, setShowOnboardingFirstRun] = useState(false);
  const [showAuthTransitionSplash, setShowAuthTransitionSplash] = useState(false);
  const previousAuthRef = useRef(isAuthenticated);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList> | null>(null);
  const currentRouteRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await databaseService.initialize();
        setDbInitialized(true);
      } catch (error) {
        console.error("Failed to initialize database:", error);
      }
    };

    initializeDatabase();
  }, []);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isAuthenticated || !dbInitialized) {
        setOnboardingChecked(false);
        return;
      }

      const isDone = await onboardingService.isCompleted();
      setShowOnboardingFirstRun(!isDone);
      setOnboardingChecked(true);
    };

    checkOnboardingStatus();
  }, [isAuthenticated, dbInitialized]);

  useEffect(() => {
    if (previousAuthRef.current === false && isAuthenticated) {
      setShowAuthTransitionSplash(true);
      const timer = setTimeout(() => {
        setShowAuthTransitionSplash(false);
      }, 650);

      previousAuthRef.current = isAuthenticated;
      return () => clearTimeout(timer);
    }

    previousAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.name || undefined,
      });
      Sentry.setTag("user_provider", user.provider);
    } else {
      Sentry.setUser(null);
      Sentry.setTag("user_provider", "none");
    }

    Sentry.setTag("auth_state", isAuthenticated ? "authenticated" : "anonymous");
  }, [isAuthenticated, user?.id, user?.email, user?.name, user?.provider]);

  const handleNavigationReady = () => {
    const routeName = navigationRef.current?.getCurrentRoute?.()?.name;
    if (routeName) {
      currentRouteRef.current = routeName;
      Sentry.setTag("navigation_route", routeName);
    }
  };

  const handleNavigationStateChange = () => {
    const routeName = navigationRef.current?.getCurrentRoute?.()?.name;
    if (routeName && routeName !== currentRouteRef.current) {
      currentRouteRef.current = routeName;
      Sentry.setTag("navigation_route", routeName);
    }
  };

  if (
    isLoading ||
    !dbInitialized ||
    (isAuthenticated && !onboardingChecked) ||
    showAuthTransitionSplash
  ) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        <NavigationContainer
          ref={navigationRef}
          onReady={handleNavigationReady}
          onStateChange={handleNavigationStateChange}
        >
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth" component={AuthScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </>
    );
  }

  // SubscriptionProvider now wraps the authenticated app content
  // This ensures the database is initialized before subscription queries run
  return (
    <SubscriptionProvider>
      <TabBarProvider>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        <NavigationContainer
          ref={navigationRef}
          onReady={handleNavigationReady}
          onStateChange={handleNavigationStateChange}
        >
          <Stack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName={showOnboardingFirstRun ? "Onboarding" : "MainApp"}
          >
            <Stack.Screen name="Onboarding" component={OnboardingScreenWrapper} />
            <Stack.Screen name="MainApp" component={MainTabNavigator} />
            <Stack.Screen
              name="DesignFlow"
              component={DesignFlowNavigator}
              options={{
                presentation: "modal",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="DesignDetail"
              component={DesignDetailScreenWrapper}
              options={{
                presentation: "card",
                headerShown: false,
                animation: "default",
                cardStyle: { backgroundColor: "#000" },
              }}
            />
            <Stack.Screen
              name="PlantDetail"
              component={PlantDetailScreenWrapper}
              options={{
                presentation: "modal",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{ presentation: "modal" }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </TabBarProvider>
    </SubscriptionProvider>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <EnvValidator>
            <ToastProvider>
              <NetworkProvider>
                <DebugPreferencesProvider>
                  <AuthProvider>
                    <AppContent />
                  </AuthProvider>
                </DebugPreferencesProvider>
              </NetworkProvider>
            </ToastProvider>
          </EnvValidator>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);

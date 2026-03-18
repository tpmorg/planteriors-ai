import React, { useState, useEffect, useRef } from "react";
import Constants from "expo-constants";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, TouchableOpacity, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import * as Sentry from "@sentry/react-native";

import { AppIcon } from "./src/components/AppIcon";
import { NetworkProvider } from "./src/contexts/NetworkContext";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { TabBarProvider, useTabBar } from "./src/contexts/TabBarContext";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { SubscriptionProvider } from "./src/contexts/SubscriptionContext";
import { DebugPreferencesProvider } from "./src/contexts/DebugPreferencesContext";
import { ToastProvider } from "./src/contexts/ToastContext";
import { AuthScreen } from "./src/screens/AuthScreen";
import { CameraScreen } from "./src/screens/CameraScreen";
import { PlantSelectionScreen } from "./src/screens/PlantSelectionScreen";
import { PlantLocationScreen } from "./src/screens/PlantLocationScreen";
import { GenerationScreen } from "./src/screens/GenerationScreen";
import { GalleryScreen } from "./src/screens/GalleryScreen";
import { DesignDetailScreen } from "./src/screens/DesignDetailScreen";
import { AccountScreen } from "./src/screens/AccountScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { SubscriptionScreen } from "./src/screens/SubscriptionScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { PlantIdentifyScreen } from "./src/screens/PlantIdentifyScreen";
import { EnvValidator } from "./src/components/EnvValidator";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import SplashScreen from "./src/components/SplashScreen";
import {
  GenerationRequest,
  GeneratedImage,
  SavedDesign,
  PlantLocation,
} from "./src/types";
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

type RootStackParamList = {
  Auth: undefined;
  MainApp: undefined;
  DesignFlow: { screen?: keyof DesignFlowStackParamList; params?: any } | undefined;
  DesignDetail: { design: SavedDesign; designs?: SavedDesign[]; initialIndex?: number };
  Subscription: undefined;
  PlantIdentify: { capturedImageUri?: string; capturedImageAt?: number } | undefined;
  PlantCamera: undefined;
  Onboarding: { fromSettings?: boolean } | undefined;
};

type DesignFlowStackParamList = {
  Camera: { mode?: 'room' | 'plant-id' };
  PlantSelection: { imageUri: string };
  PlantLocation: { imageUri: string; request: Omit<GenerationRequest, 'imageUri' | 'location'> };
  Generation: { request: GenerationRequest };
};

type TabParamList = {
  Gallery: undefined;
  Account: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const DesignFlowStack = createStackNavigator<DesignFlowStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Custom Tab Bar Component
function CustomTabBar({ state, descriptors, navigation }: any) {
  const { tabBarStyle } = useTabBar();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.colors.tabBarBackground,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 12,
          height: 65 + Math.max(insets.bottom, 8),
          shadowColor: theme.colors.shadow,
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: theme.isDark ? 0.34 : 0.1,
          shadowRadius: theme.isDark ? 14 : 8,
          elevation: 8,
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "flex-start",
          paddingHorizontal: 0,
        },
        tabBarStyle,
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        let iconName: string;
        let iconWeight: "regular" | "fill" = "regular";
        if (route.name === "Gallery") {
          iconName = "Images";
          iconWeight = isFocused ? "fill" : "regular";
        } else if (route.name === "Account") {
          iconName = "User";
          iconWeight = isFocused ? "fill" : "regular";
        } else if (route.name === "Settings") {
          iconName = "Gear";
          iconWeight = isFocused ? "fill" : "regular";
        } else {
          iconName = "Question";
        }

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 4,
            }}
          >
            <AppIcon
              name={iconName}
              size={24}
              color={
                isFocused
                  ? theme.colors.tabBarActive
                  : theme.colors.tabBarInactive
              }
              weight={iconWeight}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "500",
                marginTop: 3,
                color: isFocused
                  ? theme.colors.tabBarActive
                  : theme.colors.tabBarInactive,
              }}
            >
              {route.name}
            </Text>
            <View
              style={{
                width: 20,
                height: 3,
                borderRadius: 2,
                marginTop: 3,
                backgroundColor: isFocused
                  ? theme.colors.tabBarActive
                  : "transparent",
              }}
            />
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

// Main Tab Navigator Component
function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Gallery" component={GalleryScreenWrapper} />
      <Tab.Screen name="Account" component={AccountScreenWrapper} />
      <Tab.Screen name="Settings" component={SettingsScreenWrapper} />
    </Tab.Navigator>
  );
}

function AccountScreenWrapper({ navigation }: any) {
  const handleUpgradePress = () => {
    navigation.navigate("Subscription");
  };

  return <AccountScreen onUpgradePress={handleUpgradePress} />;
}

function SettingsScreenWrapper({ navigation }: any) {
  const handleOpenOnboarding = () => {
    navigation.navigate("Onboarding", { fromSettings: true });
  };

  return <SettingsScreen onOpenOnboarding={handleOpenOnboarding} />;
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useTheme();
  const [dbInitialized, setDbInitialized] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboardingFirstRun, setShowOnboardingFirstRun] = useState(false);
  const [showAuthTransitionSplash, setShowAuthTransitionSplash] = useState(false);
  const previousAuthRef = useRef(isAuthenticated);
  const navigationRef = useRef<any>(null);
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
                presentation: Platform.OS === "ios" ? "fullScreenModal" : "modal",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="DesignDetail"
              component={DesignDetailScreenWrapper}
              options={{
                presentation: "card",
                headerShown: false,
                animation: Platform.OS === "android" ? "fade" : "default",
                cardStyle: { backgroundColor: "#000" },
              }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="PlantIdentify"
              component={PlantIdentifyScreenWrapper}
            />
            <Stack.Screen
              name="PlantCamera"
              component={PlantCameraScreenWrapper}
              options={{
                presentation: Platform.OS === "ios" ? "fullScreenModal" : "modal",
                headerShown: false,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </TabBarProvider>
    </SubscriptionProvider>
  );
}

function OnboardingScreenWrapper({ route, navigation }: any) {
  const fromSettings = route.params?.fromSettings === true;

  const handleComplete = async () => {
    await onboardingService.markCompleted();

    if (fromSettings) {
      navigation.goBack();
      return;
    }

    navigation.replace("MainApp");
  };

  return <OnboardingScreen fromSettings={fromSettings} onComplete={handleComplete} />;
}

function DesignFlowNavigator() {
  return (
    <DesignFlowStack.Navigator screenOptions={{ headerShown: false }}>
      <DesignFlowStack.Screen name="Camera" component={CameraScreenWrapper} />
      <DesignFlowStack.Screen name="PlantSelection" component={PlantSelectionScreenWrapper} />
      <DesignFlowStack.Screen name="PlantLocation" component={PlantLocationScreenWrapper} />
      <DesignFlowStack.Screen name="Generation" component={GenerationScreenWrapper} />
    </DesignFlowStack.Navigator>
  );
}

function CameraScreenWrapper({ navigation, route }: any) {
  const { user } = useAuth();
  const { mode } = route.params || {};
  const [recentSourceImages, setRecentSourceImages] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadRecentImages = async () => {
      try {
        const images = await databaseService.getRecentSourceImageUris(user?.id, 24);
        if (mounted) {
          setRecentSourceImages(images);
        }
      } catch (error) {
        console.error("Failed to load recent source images:", error);
      }
    };

    loadRecentImages();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleImageTaken = (imageUri: string) => {
    navigation.navigate("PlantSelection", { imageUri });
  };

  const handleClose = () => {
    navigation.getParent()?.goBack();
  };

  return (
    <CameraScreen
      onImageTaken={handleImageTaken}
      onClose={handleClose}
      recentSourceImages={recentSourceImages}
      mode={mode}
    />
  );
}

function PlantSelectionScreenWrapper({ route, navigation }: any) {
  const { imageUri } = route.params;

  const handlePlantSelected = (selectionData: Omit<GenerationRequest, 'imageUri'>) => {
    // For individual plant mode, go to location selection first
    if (selectionData.mode === 'individual') {
      navigation.navigate("PlantLocation", { imageUri, request: selectionData });
    } else {
      // For multi-plant mode, go directly to generation
      const request: GenerationRequest = {
        imageUri,
        ...selectionData,
      };
      navigation.navigate("Generation", { request });
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <PlantSelectionScreen
      imageUri={imageUri}
      onPlantSelected={handlePlantSelected}
      onBack={handleBack}
    />
  );
}

function PlantLocationScreenWrapper({ route, navigation }: any) {
  const { imageUri, request } = route.params;

  const handleLocationSelected = (location: PlantLocation | null) => {
    const fullRequest: GenerationRequest = location
      ? { imageUri, ...request, location }
      : { imageUri, ...request };
    navigation.navigate("Generation", { request: fullRequest });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <PlantLocationScreen
      imageUri={imageUri}
      request={request}
      onLocationSelected={handleLocationSelected}
      onBack={handleBack}
    />
  );
}

function GenerationScreenWrapper({ route, navigation }: any) {
  const { request } = route.params;

  const handleGenerationComplete = (result: GeneratedImage) => {
    navigation.getParent()?.navigate("MainApp");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleUpgradePress = () => {
    navigation.navigate("Subscription");
  };

  return (
    <GenerationScreen
      request={request}
      onGenerationComplete={handleGenerationComplete}
      onBack={handleBack}
      onUpgradePress={handleUpgradePress}
    />
  );
}

function GalleryScreenWrapper({ navigation }: any) {
  const handleNewDesign = () => {
    navigation.navigate("DesignFlow", { screen: "Camera" });
  };

  const handleIdentifyPlant = () => {
    navigation.navigate("PlantIdentify");
  };

  const handleDesignSelect = (
    design: SavedDesign,
    designs: SavedDesign[],
    initialIndex: number
  ) => {
    navigation.navigate("DesignDetail", { design, designs, initialIndex });
  };

  const handleUpgradePress = () => {
    navigation.navigate("Subscription");
  };

  return (
    <GalleryScreen
      onNewDesign={handleNewDesign}
      onIdentifyPlant={handleIdentifyPlant}
      onDesignSelect={handleDesignSelect}
      onUpgradePress={handleUpgradePress}
    />
  );
}

function PlantIdentifyScreenWrapper({ navigation, route }: any) {
  const handleBack = () => {
    navigation.goBack();
  };

  const handleOpenCamera = () => {
    navigation.navigate("PlantCamera");
  };

  return (
    <PlantIdentifyScreen
      onBack={handleBack}
      onOpenCamera={handleOpenCamera}
      capturedImageUri={route.params?.capturedImageUri}
      capturedImageAt={route.params?.capturedImageAt}
    />
  );
}

function PlantCameraScreenWrapper({ navigation }: any) {
  const handleClose = () => {
    navigation.goBack();
  };

  const handleImageTaken = (imageUri: string) => {
    navigation.navigate({
      name: "PlantIdentify",
      params: { capturedImageUri: imageUri, capturedImageAt: Date.now() },
      merge: true,
    });
    navigation.goBack();
  };

  return (
    <CameraScreen
      mode="plant-id"
      onImageTaken={handleImageTaken}
      onClose={handleClose}
      recentSourceImages={[]}
    />
  );
}

function DesignDetailScreenWrapper({ route, navigation }: any) {
  const { design, designs, initialIndex } = route.params;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDesignDeleted = () => {
    navigation.navigate("MainApp", { screen: "Gallery" });
  };

  const handleRefineDesign = (currentDesign: SavedDesign, refinementPrompt: string) => {
    const imageUri = currentDesign.localImagePath || currentDesign.generatedImageUri;
    const normalizedPrompt = refinementPrompt.trim();

    if (!imageUri || !normalizedPrompt) {
      return;
    }

    const basePromptPrefix =
      "Refine this existing generated design while preserving room layout, architecture, and all non-plant objects.";
    const prompt = `${basePromptPrefix} ${normalizedPrompt}`;

    if (currentDesign.mode === "individual") {
      if (!currentDesign.individualPlant) {
        return;
      }

      const selection = currentDesign.individualPlant;
      const individualPlantId =
        selection.id ||
        `refine-${selection.scientificName.toLowerCase().replace(/\s+/g, "-")}`;
      const suitablePlacements =
        selection.placement === "auto"
          ? ["floor", "shelf", "hanging"]
          : [selection.placement];

      const request: GenerationRequest = {
        imageUri,
        mode: "individual",
        individualPlant: {
          plant: {
            id: individualPlantId,
            name: selection.name,
            scientificName: selection.scientificName,
            description: `Indoor ${selection.name} arrangement refinement`,
            icon: "Leaf",
            category: "tropical",
            lightRequirement: "bright-indirect",
            waterRequirement: "moderate",
            availableSizes: [selection.size],
            suitablePlacements: suitablePlacements as ("floor" | "shelf" | "hanging" | "auto")[],
            careLevel: "moderate",
            growthRate: "moderate",
            petSafe: false,
          },
          size: selection.size,
          placement: selection.placement,
        },
        prompt,
      };

      navigation.navigate("Generation", { request });
      return;
    }

    if (!currentDesign.plantType || !currentDesign.plantStyle) {
      return;
    }

    const styleId = currentDesign.plantStyle.name.toLowerCase().replace(/\s+/g, "-");
    const request: GenerationRequest = {
      imageUri,
      mode: "multi-plant",
      plantType: {
        id: currentDesign.plantType.name.toLowerCase().replace(/\s+/g, "-"),
        name: currentDesign.plantType.name,
        description: currentDesign.plantType.description,
        icon: "Leaf",
        styles: [
          {
            id: styleId,
            name: currentDesign.plantStyle.name,
            description: currentDesign.plantStyle.description,
            icon: "Palette",
          },
        ],
      },
      plantStyle: {
        id: styleId,
        name: currentDesign.plantStyle.name,
        description: currentDesign.plantStyle.description,
        icon: "Palette",
      },
      prompt,
    };

    navigation.navigate("Generation", { request });
  };

  return (
    <DesignDetailScreen
      design={design}
      designs={designs}
      initialIndex={initialIndex}
      onBack={handleBack}
      onDesignDeleted={handleDesignDeleted}
      onRefineDesign={handleRefineDesign}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <EnvValidator>
          <ThemeProvider>
            <ToastProvider>
              <NetworkProvider>
                <DebugPreferencesProvider>
                  <AuthProvider>
                    <AppContent />
                  </AuthProvider>
                </DebugPreferencesProvider>
              </NetworkProvider>
            </ToastProvider>
          </ThemeProvider>
        </EnvValidator>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

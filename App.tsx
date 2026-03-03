import React, { useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TouchableOpacity, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

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

type RootStackParamList = {
  Auth: undefined;
  MainApp: undefined;
  Camera: undefined;
  PlantSelection: { imageUri: string };
  PlantLocation: { imageUri: string; request: Omit<GenerationRequest, 'imageUri' | 'location'> };
  Generation: { request: GenerationRequest };
  DesignDetail: { design: SavedDesign; designs?: SavedDesign[]; initialIndex?: number };
  Subscription: undefined;
  Onboarding: { fromSettings?: boolean } | undefined;
};

type TabParamList = {
  Gallery: undefined;
  Account: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
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

        let iconName: keyof typeof Ionicons.glyphMap;
        if (route.name === "Gallery") {
          iconName = isFocused ? "images" : "images-outline";
        } else if (route.name === "Account") {
          iconName = isFocused ? "person" : "person-outline";
        } else if (route.name === "Settings") {
          iconName = isFocused ? "settings" : "settings-outline";
        } else {
          iconName = "help-outline";
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
            <Ionicons
              name={iconName}
              size={24}
              color={
                isFocused
                  ? theme.colors.tabBarActive
                  : theme.colors.tabBarInactive
              }
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
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const [dbInitialized, setDbInitialized] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboardingFirstRun, setShowOnboardingFirstRun] = useState(false);
  const [showAuthTransitionSplash, setShowAuthTransitionSplash] = useState(false);
  const previousAuthRef = useRef(isAuthenticated);

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
        <NavigationContainer>
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
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName={showOnboardingFirstRun ? "Onboarding" : "MainApp"}
          >
            <Stack.Screen name="Onboarding" component={OnboardingScreenWrapper} />
            <Stack.Screen name="MainApp" component={MainTabNavigator} />
            <Stack.Screen name="Camera" component={CameraScreenWrapper} />
            <Stack.Screen
              name="PlantSelection"
              component={PlantSelectionScreenWrapper}
            />
            <Stack.Screen
              name="PlantLocation"
              component={PlantLocationScreenWrapper}
            />
            <Stack.Screen name="Generation" component={GenerationScreenWrapper} />
            <Stack.Screen
              name="DesignDetail"
              component={DesignDetailScreenWrapper}
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

function CameraScreenWrapper({ navigation }: any) {
  const { user } = useAuth();
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
    navigation.navigate("MainApp");
  };

  return (
    <CameraScreen
      onImageTaken={handleImageTaken}
      onClose={handleClose}
      recentSourceImages={recentSourceImages}
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
    navigation.navigate("MainApp");
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
    navigation.navigate("Camera");
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
      onDesignSelect={handleDesignSelect}
      onUpgradePress={handleUpgradePress}
    />
  );
}

function DesignDetailScreenWrapper({ route, navigation }: any) {
  const { design, designs, initialIndex } = route.params;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDesignDeleted = () => {
    navigation.navigate("MainApp");
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
      const suitablePlacements =
        selection.placement === "auto"
          ? ["floor", "shelf", "hanging"]
          : [selection.placement];

      const request: GenerationRequest = {
        imageUri,
        mode: "individual",
        individualPlant: {
          plant: {
            id: `refine-${selection.scientificName.toLowerCase().replace(/\s+/g, "-")}`,
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
              <DebugPreferencesProvider>
                <AuthProvider>
                  <AppContent />
                </AuthProvider>
              </DebugPreferencesProvider>
            </ToastProvider>
          </ThemeProvider>
        </EnvValidator>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

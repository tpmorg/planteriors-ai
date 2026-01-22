import React, { useState, useEffect } from "react";
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
import { AuthScreen } from "./src/screens/AuthScreen";
import { CameraScreen } from "./src/screens/CameraScreen";
import { PlantSelectionScreen } from "./src/screens/PlantSelectionScreen";
import { GenerationScreen } from "./src/screens/GenerationScreen";
import { GalleryScreen } from "./src/screens/GalleryScreen";
import { DesignDetailScreen } from "./src/screens/DesignDetailScreen";
import { AccountScreen } from "./src/screens/AccountScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { EnvValidator } from "./src/components/EnvValidator";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import {
  GenerationRequest,
  GeneratedImage,
  PlantType,
  PlantStyle,
  PlantOptions,
  SavedDesign,
} from "./src/types";
import { databaseService } from "./src/services/databaseService";

type RootStackParamList = {
  Auth: undefined;
  MainApp: undefined;
  Camera: undefined;
  PlantSelection: { imageUri: string };
  Generation: { request: GenerationRequest };
  DesignDetail: { design: SavedDesign };
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
          shadowOpacity: 0.1,
          shadowRadius: 8,
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
                fontSize: 12,
                fontWeight: "500",
                marginTop: 2,
                color: isFocused
                  ? theme.colors.tabBarActive
                  : theme.colors.tabBarInactive,
              }}
            >
              {route.name}
            </Text>
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
      <Tab.Screen name="Account" component={AccountScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const [dbInitialized, setDbInitialized] = useState(false);

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

  if (isLoading || !dbInitialized) {
    return null; // or a loading screen
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

  return (
    <TabBarProvider>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainApp" component={MainTabNavigator} />
          <Stack.Screen name="Camera" component={CameraScreenWrapper} />
          <Stack.Screen
            name="PlantSelection"
            component={PlantSelectionScreenWrapper}
          />
          <Stack.Screen name="Generation" component={GenerationScreenWrapper} />
          <Stack.Screen
            name="DesignDetail"
            component={DesignDetailScreenWrapper}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </TabBarProvider>
  );
}

function CameraScreenWrapper({ navigation }: any) {
  const handleImageTaken = (imageUri: string) => {
    navigation.navigate("PlantSelection", { imageUri });
  };

  const handleClose = () => {
    navigation.navigate("MainApp");
  };

  return <CameraScreen onImageTaken={handleImageTaken} onClose={handleClose} />;
}

function PlantSelectionScreenWrapper({ route, navigation }: any) {
  const { imageUri } = route.params;

  const handlePlantSelected = (
    plantType: PlantType,
    plantStyle: PlantStyle,
    plantOptions?: PlantOptions,
  ) => {
    const request: GenerationRequest = {
      imageUri,
      plantType,
      plantStyle,
      plantOptions,
    };
    navigation.navigate("Generation", { request });
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

function GenerationScreenWrapper({ route, navigation }: any) {
  const { request } = route.params;

  const handleGenerationComplete = (result: GeneratedImage) => {
    navigation.navigate("MainApp");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <GenerationScreen
      request={request}
      onGenerationComplete={handleGenerationComplete}
      onBack={handleBack}
    />
  );
}

function GalleryScreenWrapper({ navigation }: any) {
  const handleNewDesign = () => {
    navigation.navigate("Camera");
  };

  const handleDesignSelect = (design: SavedDesign) => {
    navigation.navigate("DesignDetail", { design });
  };

  return (
    <GalleryScreen
      onNewDesign={handleNewDesign}
      onDesignSelect={handleDesignSelect}
    />
  );
}

function DesignDetailScreenWrapper({ route, navigation }: any) {
  const { design } = route.params;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDesignDeleted = () => {
    navigation.navigate("MainApp");
  };

  return (
    <DesignDetailScreen
      design={design}
      onBack={handleBack}
      onDesignDeleted={handleDesignDeleted}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <EnvValidator>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </EnvValidator>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

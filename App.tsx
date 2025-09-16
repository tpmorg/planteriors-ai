import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { CameraScreen } from './src/screens/CameraScreen';
import { PlantSelectionScreen } from './src/screens/PlantSelectionScreen';
import { GenerationScreen } from './src/screens/GenerationScreen';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { DesignDetailScreen } from './src/screens/DesignDetailScreen';
import { EnvValidator } from './src/components/EnvValidator';
import { GenerationRequest, GeneratedImage, PlantType, PlantStyle, SavedDesign } from './src/types';
import { databaseService } from './src/services/databaseService';

type RootStackParamList = {
  Auth: undefined;
  Camera: undefined;
  PlantSelection: { imageUri: string };
  Generation: { request: GenerationRequest };
  Gallery: undefined;
  DesignDetail: { design: SavedDesign };
};

const Stack = createStackNavigator<RootStackParamList>();

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await databaseService.initialize();
        setDbInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeDatabase();
  }, []);

  if (isLoading || !dbInitialized) {
    return null; // or a loading screen
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Camera" component={CameraScreenWrapper} />
        <Stack.Screen name="PlantSelection" component={PlantSelectionScreenWrapper} />
        <Stack.Screen name="Generation" component={GenerationScreenWrapper} />
        <Stack.Screen name="Gallery" component={GalleryScreenWrapper} />
        <Stack.Screen name="DesignDetail" component={DesignDetailScreenWrapper} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function CameraScreenWrapper({ navigation }: any) {
  const handleImageTaken = (imageUri: string) => {
    navigation.navigate('PlantSelection', { imageUri });
  };

  const handleClose = () => {
    navigation.navigate('Gallery');
  };

  return <CameraScreen onImageTaken={handleImageTaken} onClose={handleClose} />;
}

function PlantSelectionScreenWrapper({ route, navigation }: any) {
  const { imageUri } = route.params;

  const handlePlantSelected = (plantType: PlantType, plantStyle: PlantStyle) => {
    const request: GenerationRequest = {
      imageUri,
      plantType,
      plantStyle,
    };
    navigation.navigate('Generation', { request });
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
    navigation.navigate('Gallery');
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
  const handleBack = () => {
    navigation.navigate('Camera');
  };

  const handleDesignSelect = (design: SavedDesign) => {
    navigation.navigate('DesignDetail', { design });
  };

  return (
    <GalleryScreen
      onBack={handleBack}
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
    navigation.navigate('Gallery');
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
      <EnvValidator>
        <AuthProvider>
          <StatusBar style="auto" />
          <AppContent />
        </AuthProvider>
      </EnvValidator>
    </SafeAreaProvider>
  );
}

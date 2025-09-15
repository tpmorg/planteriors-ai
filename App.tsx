import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { CameraScreen } from './src/screens/CameraScreen';
import { PlantSelectionScreen } from './src/screens/PlantSelectionScreen';
import { GenerationScreen } from './src/screens/GenerationScreen';
import { GenerationRequest, GeneratedImage, PlantType, PlantStyle } from './src/types';

type RootStackParamList = {
  Auth: undefined;
  Camera: undefined;
  PlantSelection: { imageUri: string };
  Generation: { request: GenerationRequest };
  Result: { result: GeneratedImage };
};

const Stack = createStackNavigator<RootStackParamList>();

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showCamera, setShowCamera] = useState(false);

  if (isLoading) {
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function CameraScreenWrapper({ navigation }: any) {
  const handleImageTaken = (imageUri: string) => {
    navigation.navigate('PlantSelection', { imageUri });
  };

  const handleClose = () => {
    // For now, just stay on the camera screen
    // In a full app, you might navigate to a home screen
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
    // For now, navigate back to camera to take another photo
    // In a full app, you might navigate to a gallery or result screen
    navigation.navigate('Camera');
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

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppContent />
    </AuthProvider>
  );
}

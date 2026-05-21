import React from 'react';
import { Alert, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlantIdentifyScreen } from '../PlantIdentifyScreen';
import { databaseService } from '../../services/databaseService';
import { createPlantIdentificationService } from '../../services/plantIdentificationService';
import { usageTrackingService } from '../../services/usageTrackingService';

jest.mock('../../components/AppIcon', () => ({
  AppIcon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        border: '#d1d5db',
        primary: '#2f7a52',
        surface: '#ffffff',
        text: '#111827',
        textSecondary: '#6b7280',
      },
    },
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
    },
  }),
}));

jest.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    refreshStatus: jest.fn(),
  }),
}));

jest.mock('../../services/databaseService', () => ({
  databaseService: {
    searchPlants: jest.fn(),
  },
}));

jest.mock('../../services/plantIdentificationService', () => ({
  createPlantIdentificationService: jest.fn(),
}));

jest.mock('../../services/subscriptionService', () => ({
  subscriptionService: {
    getSubscriptionStatus: jest.fn().mockResolvedValue({ isActive: false }),
  },
}));

jest.mock('../../services/usageTrackingService', () => ({
  usageTrackingService: {
    canGenerateImage: jest.fn().mockResolvedValue({ canGenerate: true, freeRemaining: 5 }),
    trackGeneration: jest.fn().mockResolvedValue(undefined),
  },
}));

const identifiedPlant = {
  commonName: 'Monstera Deliciosa',
  scientificName: 'Monstera deliciosa',
  confidence: 0.93,
  category: 'tropical',
  careLevel: 'moderate',
  lightRequirement: 'bright-indirect',
  waterRequirement: 'moderate',
  availableSizes: ['medium', 'large'],
  suitablePlacements: ['floor'],
  description: 'A tropical plant with fenestrated leaves.',
  careTips: ['Keep soil lightly moist.'],
  healthAssessment: 'Looks healthy.',
};

const renderPlantIdentify = () =>
  render(
    <PlantIdentifyScreen
      onBack={jest.fn()}
      onOpenCamera={jest.fn()}
      onUpgradePress={jest.fn()}
      onCapturedImageHandled={jest.fn()}
      capturedImageUri="file:///plant.jpg"
      capturedImageAt={Date.now()}
    />
  );

const renderPlantIdentifyStart = (props?: Partial<React.ComponentProps<typeof PlantIdentifyScreen>>) => {
  const defaultProps = {
    onBack: jest.fn(),
    onOpenCamera: jest.fn(),
    onUpgradePress: jest.fn(),
  };

  return {
    props: defaultProps,
    ...render(<PlantIdentifyScreen {...defaultProps} {...props} />),
  };
};

describe('PlantIdentifyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    (usageTrackingService.canGenerateImage as jest.Mock).mockResolvedValue({
      canGenerate: true,
      freeRemaining: 5,
    });
    (usageTrackingService.trackGeneration as jest.Mock).mockResolvedValue(undefined);
    (createPlantIdentificationService as jest.Mock).mockReturnValue({
      identifyPlantFromImage: jest.fn().mockResolvedValue(identifiedPlant),
      saveIdentificationToPlantDb: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('shows duplicate state and disables add when identified plant already exists', async () => {
    (databaseService.searchPlants as jest.Mock).mockResolvedValue([
      {
        id: 'monstera-deliciosa',
        name: 'Monstera Deliciosa',
      },
    ]);

    const { findByText, getByLabelText } = renderPlantIdentify();

    expect(await findByText('Monstera Deliciosa')).toBeOnTheScreen();
    expect(await findByText('Already in Plant Library.')).toBeOnTheScreen();

    await waitFor(() => {
      expect(getByLabelText('Plant already in library')).toBeDisabled();
    });
  });

  it('sends users to subscription before opening Plant ID camera when free quota is exhausted', async () => {
    (usageTrackingService.canGenerateImage as jest.Mock).mockResolvedValue({
      canGenerate: false,
      reason: 'limit_exceeded',
      freeRemaining: 0,
    });

    const { getByText, props } = renderPlantIdentifyStart();

    fireEvent.press(getByText('Take / Upload Photo'));

    await waitFor(() => {
      expect(props.onUpgradePress).toHaveBeenCalledTimes(1);
    });
    expect(props.onOpenCamera).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { Alert, Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { PlantIdentifyScreen } from '../PlantIdentifyScreen';
import { databaseService } from '../../services/databaseService';
import { createPlantIdentificationService } from '../../services/plantIdentificationService';

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

jest.mock('../../services/databaseService', () => ({
  databaseService: {
    searchPlants: jest.fn(),
  },
}));

jest.mock('../../services/plantIdentificationService', () => ({
  createPlantIdentificationService: jest.fn(),
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
      onCapturedImageHandled={jest.fn()}
      capturedImageUri="file:///plant.jpg"
      capturedImageAt={Date.now()}
    />
  );

describe('PlantIdentifyScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
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
});

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { LibraryScreen } from '../LibraryScreen';
import { databaseService } from '../../services/databaseService';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../../components/AppIcon', () => ({
  AppIcon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

jest.mock('../../contexts/TabBarContext', () => ({
  useTabBar: () => ({
    handleScroll: jest.fn(),
    tabBarHeight: 72,
  }),
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
    getPlantsCount: jest.fn(),
    searchPlants: jest.fn(),
  },
}));

const builtInPlant = {
  id: 'snake-plant',
  name: 'Snake Plant',
  scientificName: 'Dracaena trifasciata',
  category: 'succulent',
  icon: 'Plant',
  careLevel: 'easy',
  lightRequirement: 'low-to-bright',
  petSafe: false,
  availableSizes: ['medium'],
  suitablePlacements: ['floor'],
  isPopular: true,
  userAdded: false,
};

const importedPlant = {
  id: 'imported-monstera',
  name: 'Monstera Deliciosa',
  scientificName: 'Monstera deliciosa',
  category: 'tropical',
  icon: 'Leaf',
  careLevel: 'moderate',
  lightRequirement: 'bright-indirect',
  petSafe: false,
  availableSizes: ['large'],
  suitablePlacements: ['floor'],
  isPopular: false,
  userAdded: true,
};

describe('LibraryScreen', () => {
  beforeEach(() => {
    (databaseService.getPlantsCount as jest.Mock).mockResolvedValue(2);
    (databaseService.searchPlants as jest.Mock).mockResolvedValue([builtInPlant, importedPlant]);
  });

  it('lists the full plant library by default and marks imported plants', async () => {
    const { findByText } = render(<LibraryScreen onPlantSelect={jest.fn()} />);

    expect(await findByText('Snake Plant')).toBeOnTheScreen();
    expect(await findByText('Monstera Deliciosa')).toBeOnTheScreen();
    expect(await findByText('Imported')).toBeOnTheScreen();

    await waitFor(() => {
      expect(databaseService.searchPlants).toHaveBeenCalledWith('', { limit: 500 });
    });
  });
});

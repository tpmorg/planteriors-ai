import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import { FavoritesScreen } from '../FavoritesScreen';
import { databaseService } from '../../services/databaseService';

let mockLibraryVersion = 0;
let mockLibraryListeners: Array<() => void> = [];

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
      isDark: false,
      colors: {
        background: '#ffffff',
        border: '#d1d5db',
        borderLight: '#f3f4f6',
        card: '#ffffff',
        primary: '#2f7a52',
        shadow: '#000000',
        surface: '#ffffff',
        text: '#111827',
        textSecondary: '#6b7280',
      },
    },
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
  }),
}));

jest.mock('../../services/databaseService', () => ({
  databaseService: {
    getAllDesigns: jest.fn(),
    getCollections: jest.fn(),
    createCollection: jest.fn(),
    getLibraryChangeVersion: jest.fn(() => mockLibraryVersion),
    subscribeToLibraryChanges: jest.fn((listener: () => void) => {
      mockLibraryListeners.push(listener);
      return () => {
        mockLibraryListeners = mockLibraryListeners.filter((item) => item !== listener);
      };
    }),
  },
}));

const baseDesign = {
  id: 'design-1',
  originalImageUri: 'file://original.png',
  generatedImageUri: 'file://generated.png',
  localImagePath: 'file://generated.png',
  mode: 'multi-plant',
  plantType: {
    name: 'Ferns',
    description: 'Green and soft',
  },
  plantStyle: {
    name: 'Modern',
    description: 'Clean',
  },
  createdAt: new Date('2026-05-01T12:00:00Z'),
};

describe('FavoritesScreen', () => {
  beforeEach(() => {
    mockLibraryVersion = 0;
    mockLibraryListeners = [];
    jest.clearAllMocks();
    (databaseService.getCollections as jest.Mock).mockResolvedValue([]);
  });

  it('reloads favorites when saved design data changes elsewhere in the app', async () => {
    (databaseService.getAllDesigns as jest.Mock)
      .mockResolvedValueOnce([{ ...baseDesign, isFavorite: false }])
      .mockResolvedValue([{ ...baseDesign, isFavorite: true }]);

    const { findByText, queryByLabelText } = render(
      <FavoritesScreen onDesignSelect={jest.fn()} />
    );

    expect(await findByText('No favorites yet')).toBeOnTheScreen();
    expect(queryByLabelText('Open Ferns')).toBeNull();

    await act(async () => {
      mockLibraryVersion += 1;
      mockLibraryListeners.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(queryByLabelText('Open Ferns')).toBeOnTheScreen();
    });
  });
});

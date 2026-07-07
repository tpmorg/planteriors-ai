import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

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

jest.mock('expo-speech-recognition', () => ({
  __listeners: {} as Record<string, ((event?: any) => void)[]>,
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(() => true),
    requestPermissionsAsync: jest.fn().mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
      expires: 'never',
    }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: function useSpeechRecognitionEvent(
    eventName: string,
    listener: (event?: any) => void
  ) {
    const React = require('react');
    const speechRecognitionModule = require('expo-speech-recognition');
    React.useEffect(() => {
      speechRecognitionModule.__listeners[eventName] = speechRecognitionModule.__listeners[eventName] || [];
      speechRecognitionModule.__listeners[eventName].push(listener);

      return () => {
        speechRecognitionModule.__listeners[eventName] = (speechRecognitionModule.__listeners[eventName] || []).filter(
          (item: (event?: any) => void) => item !== listener
        );
      };
    }, [eventName, listener]);
  },
}));

const speechRecognitionModule = jest.requireMock('expo-speech-recognition');
const mockSpeechRecognition = speechRecognitionModule.ExpoSpeechRecognitionModule as {
  isRecognitionAvailable: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
};
const speechRecognitionListeners = speechRecognitionModule.__listeners as Record<
  string,
  Array<(event?: any) => void>
>;

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
    Object.keys(speechRecognitionListeners).forEach((key) => {
      delete speechRecognitionListeners[key];
    });
    mockSpeechRecognition.isRecognitionAvailable.mockReturnValue(true);
    mockSpeechRecognition.requestPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
      expires: 'never',
    });
    mockSpeechRecognition.start.mockClear();
    mockSpeechRecognition.stop.mockClear();
    (databaseService.getPlantsCount as jest.Mock).mockResolvedValue(2);
    (databaseService.searchPlants as jest.Mock).mockResolvedValue([builtInPlant, importedPlant]);
  });

  it('lists the full plant library by default and marks imported plants', async () => {
    const { findByLabelText, findByText } = render(<LibraryScreen onPlantSelect={jest.fn()} />);

    expect(await findByLabelText('Open Snake Plant')).toBeOnTheScreen();
    expect(await findByLabelText('Open Monstera Deliciosa')).toBeOnTheScreen();
    expect(await findByText('Imported')).toBeOnTheScreen();

    await waitFor(() => {
      expect(databaseService.searchPlants).toHaveBeenCalledWith('', { limit: 500 });
    });
  });

  it('applies compact library filters to the plant search query', async () => {
    const { findByText, getByLabelText } = render(<LibraryScreen onPlantSelect={jest.fn()} />);

    expect(await findByText('Snake Plant')).toBeOnTheScreen();

    fireEvent.press(getByLabelText('Show library filters'));
    fireEvent.press(await findByText('Low tolerant'));
    fireEvent.press(await findByText('Pet safe'));
    fireEvent.press(await findByText('High moisture'));
    fireEvent.press(await findByText('Hanging'));

    await waitFor(() => {
      expect(databaseService.searchPlants).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          lightRequirements: ['low', 'low-to-bright'],
          petSafe: true,
          waterRequirement: 'high',
          placement: 'hanging',
          limit: 500,
        })
      );
    });
  });

  it('starts voice search and updates the query from speech results', async () => {
    const { getByLabelText } = render(<LibraryScreen onPlantSelect={jest.fn()} />);

    fireEvent.press(getByLabelText('Start voice search'));

    await waitFor(() => {
      expect(mockSpeechRecognition.requestPermissionsAsync).toHaveBeenCalled();
      expect(mockSpeechRecognition.start).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: 'en-US',
          iosTaskHint: 'search',
          interimResults: true,
        })
      );
    });

    const emit = speechRecognitionListeners.result?.[0];
    await act(async () => {
      emit?.({
        isFinal: true,
        results: [{ transcript: 'snake plant', confidence: 0.95, segments: [] }],
      });
    });

    await waitFor(() => {
      expect(databaseService.searchPlants).toHaveBeenLastCalledWith('snake plant', { limit: 500 });
    });
  });
});

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { IndividualPlantSelector } from '../IndividualPlantSelector';

jest.mock('../AppIcon', () => ({
  AppIcon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
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

jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
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

describe('IndividualPlantSelector', () => {
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
  });

  it('starts voice search and filters plants from speech results', async () => {
    const { getByLabelText, findByText, queryByText } = render(
      <IndividualPlantSelector
        selection={null}
        onSelectionChange={jest.fn()}
      />
    );

    expect(await findByText('Monstera Deliciosa')).toBeOnTheScreen();
    expect(queryByText('Snake Plant')).toBeOnTheScreen();

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
      expect(queryByText('Snake Plant')).toBeOnTheScreen();
      expect(queryByText('Monstera Deliciosa')).toBeNull();
    });
  });
});

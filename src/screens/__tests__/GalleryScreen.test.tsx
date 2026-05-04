import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { GalleryScreen } from '../GalleryScreen';
import { databaseService } from '../../services/databaseService';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => callback(),
}));

jest.mock('../../components/AppIcon', () => ({
  AppIcon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

jest.mock('../../components/UsageIndicator', () => ({
  UsageIndicator: () => {
    const { Text } = require('react-native');
    return <Text>Usage indicator</Text>;
  },
}));

jest.mock('../../components/CollectionPickerModal', () => ({
  CollectionPickerModal: () => null,
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
        card: '#ffffff',
        primary: '#2f7a52',
        shadow: '#000000',
        surface: '#ffffff',
        tabBarBackground: '#ffffff',
        text: '#111827',
        textSecondary: '#6b7280',
      },
    },
  }),
}));

jest.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    subscription: null,
    freeGenerationsRemaining: 5,
    refreshStatus: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
  }),
}));

jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

jest.mock('../../services/databaseService', () => ({
  databaseService: {
    getAllDesigns: jest.fn(),
    getCollections: jest.fn(),
    toggleFavorite: jest.fn(),
    createCollection: jest.fn(),
    setDesignCollection: jest.fn(),
  },
}));

const renderGallery = (overrides = {}) => {
  const props = {
    onNewDesign: jest.fn(),
    onIdentifyPlant: jest.fn(),
    onDesignSelect: jest.fn(),
    onUpgradePress: jest.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<GalleryScreen {...props} />),
  };
};

describe('GalleryScreen', () => {
  beforeEach(() => {
    (databaseService.getAllDesigns as jest.Mock).mockResolvedValue([]);
    (databaseService.getCollections as jest.Mock).mockResolvedValue([]);
  });

  it('opens the new-design flow from the floating plus button', async () => {
    const { findByText, getByLabelText, props } = renderGallery();

    await findByText('No designs yet');

    fireEvent.press(getByLabelText('New design'));

    expect(props.onNewDesign).toHaveBeenCalledTimes(1);
  });

  it('opens plant identification from the floating magnifying glass button', async () => {
    const { findByText, getByLabelText, getByText, props } = renderGallery();

    await findByText('No designs yet');

    expect(getByText('MagnifyingGlass')).toBeOnTheScreen();

    fireEvent.press(getByLabelText('Identify plant'));

    expect(props.onIdentifyPlant).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state and starts a first design from its CTA', async () => {
    const { findByText, getByText, props } = renderGallery();

    expect(await findByText('No designs yet')).toBeOnTheScreen();

    fireEvent.press(getByText('Create Your First Design'));

    expect(props.onNewDesign).toHaveBeenCalledTimes(1);
  });

  it('loads gallery data and collections on mount', async () => {
    renderGallery();

    await waitFor(() => {
      expect(databaseService.getAllDesigns).toHaveBeenCalled();
      expect(databaseService.getCollections).toHaveBeenCalledWith('test-user');
    });
  });
});

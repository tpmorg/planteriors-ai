import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { GalleryScreen } from '../GalleryScreen';
import { databaseService } from '../../services/databaseService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('true'),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

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
  CollectionPickerModal: ({
    visible,
    onSelect,
  }: {
    visible: boolean;
    onSelect: (collectionId: string | null) => void;
  }) => {
    if (!visible) {
      return null;
    }
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Text>Collection modal</Text>
        <Pressable accessibilityLabel="Select mock collection" onPress={() => onSelect('collection-1')}>
          <Text>Select collection</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('../AccountScreen', () => ({
  AccountScreen: () => {
    const { Text } = require('react-native');
    return <Text>Account screen</Text>;
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
    getLibraryChangeVersion: jest.fn(() => 0),
    subscribeToLibraryChanges: jest.fn(() => jest.fn()),
    toggleFavorite: jest.fn(),
    createCollection: jest.fn(),
    setDesignCollection: jest.fn(),
    deleteDesign: jest.fn(),
  },
}));

jest.mock('../../utils/imageSave', () => ({
  requestPhotoSavePermission: jest.fn().mockResolvedValue(true),
  saveDesignImageToDevice: jest.fn().mockResolvedValue(true),
}));

const mockDesign = {
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
  isFavorite: false,
} as const;

const mockDesignTwo = {
  id: 'design-2',
  originalImageUri: 'file://original-2.png',
  generatedImageUri: 'file://generated-2.png',
  localImagePath: 'file://generated-2.png',
  mode: 'multi-plant',
  plantType: {
    name: 'Palms',
    description: 'Tall and airy',
  },
  plantStyle: {
    name: 'Organic',
    description: 'Soft',
  },
  createdAt: new Date('2026-05-01T13:00:00Z'),
  isFavorite: false,
} as const;

const renderGallery = (overrides = {}) => {
  const props = {
    onNewDesign: jest.fn(),
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
    jest.clearAllMocks();
    (databaseService.getAllDesigns as jest.Mock).mockResolvedValue([]);
    (databaseService.getCollections as jest.Mock).mockResolvedValue([]);
  });

  it('opens the account sheet from the top-right profile button', async () => {
    const { findByLabelText, findByText } = renderGallery();

    fireEvent.press(await findByLabelText('Open account'));

    expect(await findByText('Account screen')).toBeOnTheScreen();
  });

  it('does not expose the retired plant identification action', async () => {
    const { findByText, queryByLabelText } = renderGallery();

    await findByText('No designs yet');

    expect(queryByLabelText('Identify plant')).not.toBeOnTheScreen();
  });

  it('shows the empty state and starts a first design from its CTA', async () => {
    const { findByText, getByText, props } = renderGallery();

    expect(await findByText('No designs yet')).toBeOnTheScreen();

    fireEvent.press(getByText('Start With A Photo'));

    expect(props.onNewDesign).toHaveBeenCalledTimes(1);
  });

  it('loads gallery data and collections on mount', async () => {
    renderGallery();

    await waitFor(() => {
      expect(databaseService.getAllDesigns).toHaveBeenCalled();
      expect(databaseService.getCollections).toHaveBeenCalledWith('test-user');
    });
  });

  it('enters selection mode from a design long press', async () => {
    (databaseService.getAllDesigns as jest.Mock).mockResolvedValue([mockDesign]);

    const { findByLabelText, findByText, getByLabelText } = renderGallery();

    const design = await findByLabelText('Design Ferns');
    fireEvent(design, 'longPress');

    expect(await findByText('1 selected')).toBeOnTheScreen();
    expect(getByLabelText('Add selected designs to collection')).toBeOnTheScreen();
    expect(getByLabelText('Save selected designs to device')).toBeOnTheScreen();
    expect(getByLabelText('Delete selected designs')).toBeOnTheScreen();
  });

  it('adds multiple selected designs to a collection', async () => {
    (databaseService.getAllDesigns as jest.Mock).mockResolvedValue([mockDesign, mockDesignTwo]);
    (databaseService.getCollections as jest.Mock).mockResolvedValue([
      { id: 'collection-1', name: 'Living Room', createdAt: new Date('2026-05-01T10:00:00Z') },
    ]);

    const { findAllByLabelText, getByLabelText } = renderGallery();

    const designCards = await findAllByLabelText(/Design /);
    fireEvent(designCards[0], 'longPress');
    fireEvent.press(designCards[1]);
    fireEvent.press(getByLabelText('Add selected designs to collection'));
    fireEvent.press(getByLabelText('Select mock collection'));

    await waitFor(() => {
      expect(databaseService.setDesignCollection).toHaveBeenCalledTimes(2);
      expect(databaseService.setDesignCollection).toHaveBeenCalledWith('design-1', 'collection-1');
      expect(databaseService.setDesignCollection).toHaveBeenCalledWith('design-2', 'collection-1');
    });
  });
});

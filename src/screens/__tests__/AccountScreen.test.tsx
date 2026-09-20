import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AccountScreen } from '../AccountScreen';

jest.mock('../../components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Plant User', email: 'plant@example.com', provider: 'google' },
    signOut: jest.fn(),
  }),
}));
jest.mock('../../contexts/NetworkContext', () => ({ useNetworkGuard: () => jest.fn(() => true) }));
jest.mock('../../contexts/TabBarContext', () => ({
  useTabBar: () => ({ handleScroll: jest.fn(), tabBarHeight: 72 }),
}));
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      isDark: false,
      colors: {
        background: '#ffffff', surface: '#ffffff', card: '#ffffff', border: '#dddddd', borderLight: '#eeeeee',
        text: '#111111', textSecondary: '#666666', primary: '#257047', onPrimary: '#ffffff', shadow: '#000000',
        destructive: '#b91c1c', onDestructive: '#ffffff', destructiveSurface: '#fee2e2', destructiveBorder: '#fecaca',
      },
    },
  }),
}));
jest.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    subscription: {
      isActive: false,
      type: null,
      hasRoomPackPurchase: true,
      roomPackPurchaseCount: 1,
      latestRoomPackPurchaseDate: new Date('2026-09-18T12:00:00Z').getTime(),
    },
    freeGenerationsRemaining: 20,
    usageStats: null,
    restorePurchases: jest.fn(),
    resetUsageForTesting: jest.fn(),
  }),
}));
jest.mock('../../services/firestoreSyncService', () => ({
  firestoreSyncService: {
    syncUserData: jest.fn(), restoreUserData: jest.fn(), getSyncPreflight: jest.fn(),
  },
}));

it('separates owned purchases from optional credit products and routes the selected kind', () => {
  const onUpgradePress = jest.fn();
  const screen = render(<AccountScreen onUpgradePress={onUpgradePress} />);

  expect(screen.getByText('Your design credits')).toBeOnTheScreen();
  expect(screen.getByText('20')).toBeOnTheScreen();
  expect(screen.getByTestId('account-owned-room-pack')).toBeOnTheScreen();
  expect(screen.getByText('Room Pack purchased')).toBeOnTheScreen();
  expect(screen.getByText('Get more credits')).toBeOnTheScreen();
  expect(screen.getByText('30 credits every month, plus cloud backup')).toBeOnTheScreen();
  expect(screen.getByText('20 one-time credits that never expire')).toBeOnTheScreen();
  expect(screen.getByText('Buy another Room Pack')).toBeOnTheScreen();
  expect(screen.queryByText('Usage Statistics')).toBeNull();

  fireEvent.press(screen.getByTestId('account-room-pack'));
  expect(onUpgradePress).toHaveBeenLastCalledWith('room_pack');

  fireEvent.press(screen.getByTestId('account-monthly-plan'));
  expect(onUpgradePress).toHaveBeenLastCalledWith('monthly');
});

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AccountScreen } from '../AccountScreen';

jest.mock('../../components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { multiRemove: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../services/accountDeletionService', () => ({
  requestAccountDeletion: jest.fn().mockResolvedValue({ status: 'pending', requestedAt: '2026-09-29T00:00:00.000Z' }),
}));
jest.mock('../../services/databaseService', () => ({
  databaseService: { deleteLocalAccountData: jest.fn().mockResolvedValue(undefined) },
}));
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

it('requests deletion only after confirmation, then clears local account data', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const { requestAccountDeletion } = jest.requireMock('../../services/accountDeletionService');
  const { databaseService } = jest.requireMock('../../services/databaseService');
  const screen = render(<AccountScreen />);

  fireEvent.press(screen.getByTestId('account-delete'));
  expect(requestAccountDeletion).not.toHaveBeenCalled();
  const confirmation = alert.mock.calls[0][2];
  await act(async () => {
    confirmation?.find((action) => action.text === 'Request deletion')?.onPress?.();
  });

  await waitFor(() => expect(requestAccountDeletion).toHaveBeenCalledWith('plant@example.com'));
  await waitFor(() => expect(databaseService.deleteLocalAccountData).toHaveBeenCalledWith('user-1'));
  alert.mockRestore();
});

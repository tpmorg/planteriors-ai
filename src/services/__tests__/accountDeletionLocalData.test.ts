const mockDeleteAsync = jest.fn();

jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

import { DatabaseService } from '../databaseService';

it('removes only UID-owned rows and unshared app images', async () => {
  const runAsync = jest.fn().mockResolvedValue(undefined);
  const getFirstAsync = jest.fn()
    .mockResolvedValueOnce({ 1: 1 })
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ present: 1 });
  const db = {
    getFirstAsync,
    getAllAsync: jest.fn().mockResolvedValue([{
      original_image_uri: 'file:///documents/owned.jpg',
      generated_image_uri: 'file:///cache/shared.jpg',
      local_image_path: 'https://example.com/not-local.jpg',
    }]),
    withExclusiveTransactionAsync: jest.fn(async (callback: (transaction: { runAsync: typeof runAsync }) => Promise<void>) => {
      await callback({ runAsync });
    }),
  };
  const service = new DatabaseService();
  Object.assign(service, { db });
  mockDeleteAsync.mockResolvedValue(undefined);

  await service.deleteLocalAccountData('user-1');

  expect(mockDeleteAsync).toHaveBeenCalledTimes(1);
  expect(mockDeleteAsync).toHaveBeenCalledWith('file:///documents/owned.jpg', { idempotent: true });
  expect(runAsync.mock.calls.map(([sql]) => sql)).toEqual([
    'DELETE FROM saved_designs WHERE user_id = ?',
    'DELETE FROM collections WHERE user_id = ?',
    'DELETE FROM usage_tracking WHERE user_id = ?',
    'DELETE FROM subscriptions WHERE user_id = ?',
    'DELETE FROM free_trial_usage WHERE user_id = ?',
  ]);
  expect(runAsync.mock.calls.every(([, params]) => params[0] === 'user-1')).toBe(true);
});

const mockGetIdToken = jest.fn();

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { getIdToken: (...args: unknown[]) => mockGetIdToken(...args) } },
}));

jest.mock('../../utils/env', () => ({
  env: { getAiApiUrl: () => 'https://planterior.example/' },
}));

import { auth } from '../../config/firebase';
import { requestAccountDeletion } from '../accountDeletionService';

describe('account deletion request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIdToken.mockResolvedValue('fresh-id-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deletion: { status: 'pending', requestedAt: '2026-09-29T00:00:00.000Z' } }),
    }) as typeof fetch;
  });

  it('submits the confirmation with a fresh Firebase token', async () => {
    await expect(requestAccountDeletion('user@example.com')).resolves.toMatchObject({ status: 'pending' });
    expect(mockGetIdToken).toHaveBeenCalledWith(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://planterior.example/api/v1/account/deletion-request',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-id-token' }),
        body: JSON.stringify({ confirm: true, notificationEmail: 'user@example.com' }),
      }),
    );
  });

  it('does not submit without a signed-in Firebase user', async () => {
    const previousUser = auth.currentUser;
    Object.defineProperty(auth, 'currentUser', { value: null, configurable: true });
    try {
      await expect(requestAccountDeletion()).rejects.toThrow('Please sign in');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(auth, 'currentUser', { value: previousUser, configurable: true });
    }
  });
});

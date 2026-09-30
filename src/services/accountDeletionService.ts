import { auth } from '../config/firebase';
import { env } from '../utils/env';

export interface AccountDeletionRequest {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
}

export async function requestAccountDeletion(notificationEmail?: string): Promise<AccountDeletionRequest> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to delete your account.');

  const token = await user.getIdToken(true);
  const response = await fetch(`${env.getAiApiUrl().replace(/\/$/, '')}/api/v1/account/deletion-request`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ confirm: true, ...(notificationEmail ? { notificationEmail } : {}) }),
  });
  const payload = await response.json().catch(() => ({})) as {
    deletion?: AccountDeletionRequest;
    error?: { message?: string };
  };
  if (!response.ok || !payload.deletion) {
    throw new Error(payload.error?.message || 'Could not request account deletion. Please try again.');
  }
  return payload.deletion;
}

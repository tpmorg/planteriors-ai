import { databaseService } from '../databaseService';
import { subscriptionService } from '../subscriptionService';
import { FREE_GENERATION_LIMIT, usageTrackingService } from '../usageTrackingService';

jest.mock('../databaseService', () => ({
  databaseService: {
    getFreeTrialUsage: jest.fn(),
    getTotalGenerations: jest.fn(),
    resetUserUsage: jest.fn(),
    trackUsage: jest.fn(),
    updateFreeTrialUsage: jest.fn(),
  },
}));

jest.mock('../subscriptionService', () => ({
  subscriptionService: {
    getSubscriptionStatus: jest.fn(),
  },
}));

const mockedDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockedSubscriptionService = subscriptionService as jest.Mocked<typeof subscriptionService>;

describe('usageTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSubscriptionService.getSubscriptionStatus.mockResolvedValue({
      isActive: false,
      type: null,
      expiryDate: null,
      isMock: false,
    });
    mockedDatabaseService.getFreeTrialUsage.mockResolvedValue({
      userId: 'user-123',
      generationsUsed: 0,
      firstGenerationAt: null,
      lastGenerationAt: null,
    });
  });

  describe('canGenerateImage', () => {
    it('allows active subscribers without checking free trial usage', async () => {
      mockedSubscriptionService.getSubscriptionStatus.mockResolvedValue({
        isActive: true,
        type: 'monthly',
        expiryDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        isMock: false,
      });

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({ canGenerate: true });
      expect(mockedDatabaseService.getFreeTrialUsage).not.toHaveBeenCalled();
    });

    it('allows free users while free generations remain', async () => {
      mockedDatabaseService.getFreeTrialUsage.mockResolvedValue({
        userId: 'user-123',
        generationsUsed: 2,
        firstGenerationAt: 1710000000000,
        lastGenerationAt: 1710000100000,
      });

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({
        canGenerate: true,
        freeRemaining: FREE_GENERATION_LIMIT - 2,
      });
    });

    it('blocks free users after the free generation limit is exhausted', async () => {
      mockedDatabaseService.getFreeTrialUsage.mockResolvedValue({
        userId: 'user-123',
        generationsUsed: FREE_GENERATION_LIMIT,
        firstGenerationAt: 1710000000000,
        lastGenerationAt: 1710000100000,
      });

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({
        canGenerate: false,
        reason: 'limit_exceeded',
        freeRemaining: 0,
      });
    });

    it('allows generation if the check fails so the app fails open', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
      mockedSubscriptionService.getSubscriptionStatus.mockRejectedValue(new Error('RevenueCat down'));

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({ canGenerate: true });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('trackGeneration', () => {
    it('records free generations and increments free trial usage', async () => {
      await usageTrackingService.trackGeneration('user-123', 'free');

      expect(mockedDatabaseService.trackUsage).toHaveBeenCalledWith('user-123', 'free');
      expect(mockedDatabaseService.updateFreeTrialUsage).toHaveBeenCalledWith('user-123', 1);
    });

    it('records paid generations without incrementing free trial usage', async () => {
      await usageTrackingService.trackGeneration('user-123', 'paid');

      expect(mockedDatabaseService.trackUsage).toHaveBeenCalledWith('user-123', 'paid');
      expect(mockedDatabaseService.updateFreeTrialUsage).not.toHaveBeenCalled();
    });
  });

  it('returns unlimited remaining generations for active subscribers', async () => {
    mockedSubscriptionService.getSubscriptionStatus.mockResolvedValue({
      isActive: true,
      type: 'annual',
      expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
      isMock: false,
    });

    await expect(usageTrackingService.getFreeGenerationsRemaining('user-123')).resolves.toBe(999);
    expect(mockedDatabaseService.getFreeTrialUsage).not.toHaveBeenCalled();
  });

  it('aggregates user usage stats from total and free usage', async () => {
    mockedDatabaseService.getTotalGenerations.mockResolvedValue(8);
    mockedDatabaseService.getFreeTrialUsage.mockResolvedValue({
      userId: 'user-123',
      generationsUsed: 5,
      firstGenerationAt: 1710000000000,
      lastGenerationAt: 1710000100000,
    });

    const stats = await usageTrackingService.getUserUsageStats('user-123');

    expect(stats.totalGenerations).toBe(8);
    expect(stats.freeUsed).toBe(5);
    expect(stats.paidUsed).toBe(3);
    expect(stats.firstGeneration).toEqual(new Date(1710000000000));
    expect(stats.lastGeneration).toEqual(new Date(1710000100000));
  });
});

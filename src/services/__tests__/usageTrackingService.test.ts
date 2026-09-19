import { databaseService } from '../databaseService';
import { subscriptionService } from '../subscriptionService';
import { usageTrackingService } from '../usageTrackingService';

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
    getDesignCreditBalance: jest.fn(),
  },
}));

const mockedDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockedSubscriptionService = subscriptionService as jest.Mocked<typeof subscriptionService>;

describe('usageTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSubscriptionService.getDesignCreditBalance.mockResolvedValue(5);
    mockedDatabaseService.getFreeTrialUsage.mockResolvedValue({
      userId: 'user-123',
      generationsUsed: 0,
      firstGenerationAt: null,
      lastGenerationAt: null,
    });
  });

  describe('canGenerateImage', () => {
    it('uses the RevenueCat design-credit balance', async () => {
      mockedSubscriptionService.getDesignCreditBalance.mockResolvedValue(30);

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({ canGenerate: true, freeRemaining: 30 });
      expect(mockedSubscriptionService.getDesignCreditBalance).toHaveBeenCalledWith('user-123');
    });

    it('allows users while RevenueCat credits remain', async () => {
      mockedSubscriptionService.getDesignCreditBalance.mockResolvedValue(3);

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({
        canGenerate: true,
        freeRemaining: 3,
      });
    });

    it('blocks users when RevenueCat reports no design credits', async () => {
      mockedSubscriptionService.getDesignCreditBalance.mockResolvedValue(0);

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({
        canGenerate: false,
        reason: 'limit_exceeded',
        freeRemaining: 0,
      });
    });

    it('blocks generation if the RevenueCat check fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
      mockedSubscriptionService.getDesignCreditBalance.mockRejectedValue(new Error('RevenueCat down'));

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({ canGenerate: false, reason: 'no_subscription' });
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

  it('returns the RevenueCat design-credit balance', async () => {
    mockedSubscriptionService.getDesignCreditBalance.mockResolvedValue(30);

    await expect(usageTrackingService.getFreeGenerationsRemaining('user-123')).resolves.toBe(30);
    expect(mockedSubscriptionService.getDesignCreditBalance).toHaveBeenCalledWith('user-123');
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

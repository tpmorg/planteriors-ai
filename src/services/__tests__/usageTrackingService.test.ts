import { databaseService } from '../databaseService';
import { subscriptionService } from '../subscriptionService';
import { FREE_GENERATION_LIMIT, usageTrackingService } from '../usageTrackingService';
import { aiApiService } from '../aiApiService';

jest.mock('../aiApiService', () => ({
  aiApiService: { getUsage: jest.fn() },
}));

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
const mockedAiApiService = aiApiService as jest.Mocked<typeof aiApiService>;

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
    mockedAiApiService.getUsage.mockResolvedValue({
      entitlement: { active: false },
      generation: { consumed: 0, reserved: 0, remaining: FREE_GENERATION_LIMIT },
      identification: { consumed: 0, reserved: 0, remaining: 0 },
      activeJobs: 0,
      capabilities: { generation: true, identification: false },
      policyVersion: 'test',
    });
  });

  describe('canGenerateImage', () => {
    it('uses the bounded balance returned for active monthly subscribers', async () => {
      mockedAiApiService.getUsage.mockResolvedValue({
        entitlement: { active: true },
        generation: { consumed: 0, reserved: 0, remaining: 30 },
        identification: { consumed: 0, reserved: 0, remaining: null },
        activeJobs: 0,
        capabilities: { generation: true, identification: true },
        policyVersion: 'test',
      });

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({ canGenerate: true, freeRemaining: 30 });
      expect(mockedAiApiService.getUsage).toHaveBeenCalled();
    });

    it('allows free users while free generations remain', async () => {
      mockedAiApiService.getUsage.mockResolvedValue({
        entitlement: { active: false },
        generation: { consumed: 2, reserved: 0, remaining: FREE_GENERATION_LIMIT - 2 },
        identification: { consumed: 0, reserved: 0, remaining: 0 },
        activeJobs: 0,
        capabilities: { generation: true, identification: false },
        policyVersion: 'test',
      });

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({
        canGenerate: true,
        freeRemaining: FREE_GENERATION_LIMIT - 2,
      });
    });

    it('blocks free users after the free generation limit is exhausted', async () => {
      mockedAiApiService.getUsage.mockResolvedValue({
        entitlement: { active: false },
        generation: { consumed: FREE_GENERATION_LIMIT, reserved: 0, remaining: 0 },
        identification: { consumed: 0, reserved: 0, remaining: 0 },
        activeJobs: 0,
        capabilities: { generation: false, identification: false },
        policyVersion: 'test',
      });

      const result = await usageTrackingService.canGenerateImage('user-123');

      expect(result).toEqual({
        canGenerate: false,
        reason: 'limit_exceeded',
        freeRemaining: 0,
      });
    });

    it('blocks generation if the authoritative check fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
      mockedAiApiService.getUsage.mockRejectedValue(new Error('API down'));

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

  it('returns the bounded remaining design balance for active subscribers', async () => {
    mockedAiApiService.getUsage.mockResolvedValue({
      entitlement: { active: true },
      generation: { consumed: 0, reserved: 0, remaining: 30 },
      identification: { consumed: 0, reserved: 0, remaining: null },
      activeJobs: 0,
      capabilities: { generation: true, identification: true },
      policyVersion: 'test',
    });

    await expect(usageTrackingService.getFreeGenerationsRemaining('user-123')).resolves.toBe(30);
    expect(mockedAiApiService.getUsage).toHaveBeenCalled();
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

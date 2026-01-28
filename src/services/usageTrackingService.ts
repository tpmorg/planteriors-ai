import { databaseService } from './databaseService';
import { subscriptionService } from './subscriptionService';
import { UsageStats } from '../types';

const FREE_GENERATION_LIMIT = 5;

class UsageTrackingService {
  /**
   * Check if a user can generate an image based on their subscription and usage
   */
  async canGenerateImage(userId: string): Promise<{
    canGenerate: boolean;
    reason?: 'no_subscription' | 'limit_exceeded';
    freeRemaining?: number;
  }> {
    try {
      // Check if user has an active subscription
      const subscription = await subscriptionService.getSubscriptionStatus(userId);

      if (subscription.isActive) {
        // Subscribed users have unlimited generations
        return { canGenerate: true };
      }

      // Check free trial usage
      const freeUsage = await databaseService.getFreeTrialUsage(userId);
      const freeRemaining = FREE_GENERATION_LIMIT - freeUsage.generationsUsed;

      if (freeRemaining > 0) {
        return {
          canGenerate: true,
          freeRemaining,
        };
      }

      // User has exhausted free generations and has no subscription
      return {
        canGenerate: false,
        reason: 'limit_exceeded',
        freeRemaining: 0,
      };
    } catch (error) {
      console.error('Error checking if user can generate:', error);
      // On error, allow generation but log the issue
      return { canGenerate: true };
    }
  }

  /**
   * Track a generation after it has been successfully completed
   */
  async trackGeneration(userId: string, generationType: 'free' | 'paid'): Promise<void> {
    try {
      // Track in usage_tracking table
      await databaseService.trackUsage(userId, generationType);

      // If it's a free generation, update the free_trial_usage table
      if (generationType === 'free') {
        await databaseService.updateFreeTrialUsage(userId, 1);
      }
    } catch (error) {
      console.error('Error tracking generation:', error);
      throw error;
    }
  }

  /**
   * Get the number of free generations remaining for a user
   */
  async getFreeGenerationsRemaining(userId: string): Promise<number> {
    try {
      // If user has subscription, they have unlimited (return a high number)
      const subscription = await subscriptionService.getSubscriptionStatus(userId);
      if (subscription.isActive) {
        return 999; // Effectively unlimited
      }

      const freeUsage = await databaseService.getFreeTrialUsage(userId);
      const remaining = Math.max(0, FREE_GENERATION_LIMIT - freeUsage.generationsUsed);
      return remaining;
    } catch (error) {
      console.error('Error getting free generations remaining:', error);
      return 0;
    }
  }

  /**
   * Get comprehensive usage statistics for a user
   */
  async getUserUsageStats(userId: string): Promise<UsageStats> {
    try {
      const totalGenerations = await databaseService.getTotalGenerations(userId);
      const freeUsage = await databaseService.getFreeTrialUsage(userId);

      // Calculate paid generations (total - free)
      const freeUsed = freeUsage.generationsUsed;
      const paidUsed = Math.max(0, totalGenerations - freeUsed);

      return {
        totalGenerations,
        freeUsed,
        paidUsed,
        firstGeneration: freeUsage.firstGenerationAt
          ? new Date(freeUsage.firstGenerationAt)
          : null,
        lastGeneration: freeUsage.lastGenerationAt
          ? new Date(freeUsage.lastGenerationAt)
          : null,
      };
    } catch (error) {
      console.error('Error getting user usage stats:', error);
      return {
        totalGenerations: 0,
        freeUsed: 0,
        paidUsed: 0,
        firstGeneration: null,
        lastGeneration: null,
      };
    }
  }

  /**
   * Reset a user's usage (for testing purposes)
   */
  async resetUserUsage(userId: string): Promise<void> {
    try {
      await databaseService.resetUserUsage(userId);
      console.log('Usage reset for user:', userId);
    } catch (error) {
      console.error('Error resetting user usage:', error);
      throw error;
    }
  }
}

export const usageTrackingService = new UsageTrackingService();

import { usageTrackingService, FREE_GENERATION_LIMIT } from '../services/usageTrackingService';
import { subscriptionService } from '../services/subscriptionService';
import { databaseService } from '../services/databaseService';

/**
 * Testing helpers for subscription and usage tracking
 * These helpers should ONLY be used in development/testing environments
 */
export const SubscriptionTestingHelpers = {
  /**
   * Reset a user's usage to 0 free generations
   */
  async resetUsage(userId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return;
    }

    try {
      await usageTrackingService.resetUserUsage(userId);
      console.log(`✅ Reset usage for user: ${userId}`);
    } catch (error) {
      console.error('❌ Failed to reset usage:', error);
      throw error;
    }
  },

  /**
   * Use up all free generations for a user
   */
  async exhaustFreeGenerations(userId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return;
    }

    try {
      for (let i = 0; i < FREE_GENERATION_LIMIT; i++) {
        await usageTrackingService.trackGeneration(userId, 'free');
      }
      console.log(`✅ Exhausted free generations for user: ${userId}`);
    } catch (error) {
      console.error('❌ Failed to exhaust free generations:', error);
      throw error;
    }
  },

  /**
   * Grant a test subscription to a user
   */
  async grantSubscription(
    userId: string,
    type: 'monthly' | 'annual'
  ): Promise<void> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return;
    }

    try {
      // With RevenueCat, test subscriptions must be granted through
      // the RevenueCat dashboard or platform sandbox testing.
      const expiryDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now
      await databaseService.saveSubscription({
        userId,
        subscriptionStatus: 'active',
        subscriptionType: type,
        expiryDate,
        isMock: true,
        platform: 'ios',
        purchaseDate: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      console.log(`✅ Granted test ${type} subscription for user: ${userId}`);
    } catch (error) {
      console.error('❌ Failed to grant subscription:', error);
      throw error;
    }
  },

  /**
   * Simulate subscription expiry
   */
  async expireSubscription(userId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return;
    }

    try {
      // Set expiry date to the past
      const sub = await databaseService.getSubscription(userId);
      await databaseService.saveSubscription({
        userId,
        subscriptionStatus: 'expired',
        subscriptionType: sub?.subscriptionType || 'monthly',
        expiryDate: Date.now() - 1000, // 1 second in the past
        isMock: true,
        createdAt: sub?.createdAt || Date.now(),
        updatedAt: Date.now(),
        platform: sub?.platform || 'ios',
        purchaseDate: sub?.purchaseDate || Date.now(),
        purchaseToken: sub?.purchaseToken,
        originalTransactionId: sub?.originalTransactionId,
      });
      console.log(`✅ Expired subscription for user: ${userId}`);
    } catch (error) {
      console.error('❌ Failed to expire subscription:', error);
      throw error;
    }
  },

  /**
   * Get comprehensive usage state for debugging
   */
  async getUsageState(userId: string): Promise<{
    stats: any;
    remaining: number;
    subscription: any;
  }> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return {
        stats: null,
        remaining: 0,
        subscription: null,
      };
    }

    try {
      const stats = await usageTrackingService.getUserUsageStats(userId);
      const remaining = await usageTrackingService.getFreeGenerationsRemaining(userId);
      const subscription = await subscriptionService.getSubscriptionStatus(userId);

      console.log('📊 Usage State:', {
        stats,
        remaining,
        subscription,
      });

      return { stats, remaining, subscription };
    } catch (error) {
      console.error('❌ Failed to get usage state:', error);
      throw error;
    }
  },

  /**
   * Complete reset: clear usage and subscriptions
   */
  async completeReset(userId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return;
    }

    try {
      await usageTrackingService.resetUserUsage(userId);
      await databaseService.deleteSubscription(userId);
      console.log(`✅ Complete reset for user: ${userId}`);
    } catch (error) {
      console.error('❌ Failed to complete reset:', error);
      throw error;
    }
  },

  /**
   * Scenario: Test the free tier flow
   */
  async testFreeTierFlow(userId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return;
    }

    console.log('🧪 Testing Free Tier Flow...');

    try {
      // 1. Reset to clean state
      await this.completeReset(userId);
      console.log('  1. ✅ Reset to clean state');

      // 2. Check initial state (should be full remaining)
      let state = await this.getUsageState(userId);
      if (state.remaining !== FREE_GENERATION_LIMIT) {
        throw new Error(`Expected ${FREE_GENERATION_LIMIT} free remaining, got ${state.remaining}`);
      }
      console.log(`  2. ✅ Initial state correct (${FREE_GENERATION_LIMIT} free remaining)`);

      // 3. Use 3 generations
      for (let i = 0; i < 3; i++) {
        await usageTrackingService.trackGeneration(userId, 'free');
      }
      state = await this.getUsageState(userId);
      if (state.remaining !== 2) {
        throw new Error(`Expected 2 free remaining after 3 generations, got ${state.remaining}`);
      }
      console.log('  3. ✅ Used 3 generations (2 remaining)');

      // 4. Exhaust remaining
      await this.exhaustFreeGenerations(userId);
      state = await this.getUsageState(userId);
      if (state.remaining !== 0) {
        throw new Error(`Expected 0 free remaining, got ${state.remaining}`);
      }
      console.log('  4. ✅ Exhausted all free generations (0 remaining)');

      // 5. Check that user can't generate
      const { canGenerate } = await usageTrackingService.canGenerateImage(userId);
      if (canGenerate) {
        throw new Error('User should not be able to generate without subscription');
      }
      console.log('  5. ✅ User blocked from generating');

      console.log('✅ Free Tier Flow Test PASSED');
    } catch (error) {
      console.error('❌ Free Tier Flow Test FAILED:', error);
      throw error;
    }
  },

  /**
   * Scenario: Test the subscription flow
   */
  async testSubscriptionFlow(userId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return;
    }

    console.log('🧪 Testing Subscription Flow...');

    try {
      // 1. Start with exhausted free tier
      await this.completeReset(userId);
      await this.exhaustFreeGenerations(userId);
      console.log('  1. ✅ Free tier exhausted');

      // 2. Grant subscription
      await this.grantSubscription(userId, 'monthly');
      let state = await this.getUsageState(userId);
      if (!state.subscription.isActive) {
        throw new Error('Subscription should be active');
      }
      console.log('  2. ✅ Subscription granted and active');

      // 3. User should be able to generate
      const { canGenerate } = await usageTrackingService.canGenerateImage(userId);
      if (!canGenerate) {
        throw new Error('User should be able to generate with active subscription');
      }
      console.log('  3. ✅ User can generate with subscription');

      // 4. Generate multiple times (should work)
      for (let i = 0; i < 10; i++) {
        await usageTrackingService.trackGeneration(userId, 'paid');
      }
      state = await this.getUsageState(userId);
      if (state.stats.paidUsed !== 10) {
        throw new Error(`Expected 10 paid generations, got ${state.stats.paidUsed}`);
      }
      console.log('  4. ✅ Generated 10 times with subscription');

      // 5. Expire subscription
      await this.expireSubscription(userId);
      state = await this.getUsageState(userId);
      if (state.subscription.isActive) {
        throw new Error('Subscription should be expired');
      }
      console.log('  5. ✅ Subscription expired');

      // 6. User should not be able to generate
      const { canGenerate: canGenerateAfterExpiry } =
        await usageTrackingService.canGenerateImage(userId);
      if (canGenerateAfterExpiry) {
        throw new Error('User should not be able to generate with expired subscription');
      }
      console.log('  6. ✅ User blocked after expiry');

      console.log('✅ Subscription Flow Test PASSED');
    } catch (error) {
      console.error('❌ Subscription Flow Test FAILED:', error);
      throw error;
    }
  },

  /**
   * Run all tests
   */
  async runAllTests(userId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('SubscriptionTestingHelpers should only be used in development');
      return;
    }

    console.log('🧪 Running All Subscription Tests...\n');

    try {
      await this.testFreeTierFlow(userId);
      console.log('');
      await this.testSubscriptionFlow(userId);
      console.log('');
      console.log('🎉 All Tests PASSED!');
    } catch (error) {
      console.error('❌ Test Suite FAILED');
      throw error;
    }
  },
};

// Export for easy access in dev console
if (__DEV__) {
  // @ts-ignore
  global.subHelpers = SubscriptionTestingHelpers;
  console.log('💡 Subscription testing helpers available as: global.subHelpers');
}

import { Platform } from 'react-native';
import { databaseService } from './databaseService';
import { SubscriptionProduct, SubscriptionStatus, SubscriptionData } from '../types';

// Mock product catalog
const MOCK_PRODUCTS: SubscriptionProduct[] = [
  {
    id: 'monthly_mock',
    name: 'Premium Monthly',
    price: '$9.99',
    priceValue: 9.99,
    currency: 'USD',
    period: 'month',
    features: [
      'Unlimited AI generations',
      'Priority processing',
      'HD image exports',
      'Save unlimited designs',
    ],
  },
  {
    id: 'annual_mock',
    name: 'Premium Annual',
    price: '$79.99',
    priceValue: 79.99,
    currency: 'USD',
    period: 'year',
    features: [
      'Everything in Monthly',
      'Save 33% vs monthly',
      'Priority support',
    ],
    savings: 'Save $40/year',
  },
];

class SubscriptionService {
  /**
   * Get available subscription products (mock)
   */
  async getAvailableProducts(): Promise<SubscriptionProduct[]> {
    // In production, this would fetch from App Store / Play Store
    // For now, return mock products
    return MOCK_PRODUCTS;
  }

  /**
   * Purchase a subscription (mock implementation)
   */
  async purchaseSubscription(
    userId: string,
    productId: string
  ): Promise<{
    success: boolean;
    subscription: SubscriptionStatus;
    error?: string;
  }> {
    try {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Determine subscription type and duration
      const isAnnual = productId.includes('annual');
      const subscriptionType = isAnnual ? 'annual' : 'monthly';
      const durationDays = isAnnual ? 365 : 30;
      const now = Date.now();
      const expiryDate = now + durationDays * 24 * 60 * 60 * 1000;

      // Create subscription data
      const subscriptionData: SubscriptionData = {
        userId,
        subscriptionStatus: 'active',
        subscriptionType,
        purchaseToken: `mock_token_${Date.now()}`,
        originalTransactionId: `mock_txn_${userId}_${Date.now()}`,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        purchaseDate: now,
        expiryDate,
        isMock: true,
        createdAt: now,
        updatedAt: now,
      };

      // Save to database
      await databaseService.saveSubscription(subscriptionData);

      // Return success with subscription status
      return {
        success: true,
        subscription: {
          isActive: true,
          type: subscriptionType,
          expiryDate,
          isMock: true,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          purchaseDate: now,
        },
      };
    } catch (error) {
      console.error('Mock purchase failed:', error);
      return {
        success: false,
        subscription: {
          isActive: false,
          type: null,
          expiryDate: null,
          isMock: true,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a user's current subscription status
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      const subscription = await databaseService.getSubscription(userId);

      if (!subscription) {
        return {
          isActive: false,
          type: null,
          expiryDate: null,
          isMock: true,
        };
      }

      // Check if subscription is still active
      const now = Date.now();
      const isActive =
        subscription.subscriptionStatus === 'active' &&
        subscription.expiryDate !== null &&
        subscription.expiryDate > now;

      // If expired, update status in database
      if (!isActive && subscription.subscriptionStatus === 'active') {
        await databaseService.updateSubscriptionStatus(
          userId,
          'expired',
          subscription.expiryDate || now
        );
      }

      return {
        isActive,
        type: isActive ? subscription.subscriptionType : null,
        expiryDate: subscription.expiryDate,
        isMock: subscription.isMock,
        platform: subscription.platform,
        purchaseDate: subscription.purchaseDate,
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        isActive: false,
        type: null,
        expiryDate: null,
        isMock: true,
      };
    }
  }

  /**
   * Restore purchases (mock implementation)
   * In production, this would query the app store for previous purchases
   */
  async restorePurchases(userId: string): Promise<{
    success: boolean;
    restored: number;
    error?: string;
  }> {
    try {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In mock mode, just refresh the current subscription status
      const subscription = await databaseService.getSubscription(userId);

      if (subscription && subscription.subscriptionStatus === 'active') {
        return {
          success: true,
          restored: 1,
        };
      }

      return {
        success: true,
        restored: 0,
      };
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return {
        success: false,
        restored: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel subscription (mock implementation)
   */
  async cancelSubscription(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const subscription = await databaseService.getSubscription(userId);
      if (!subscription) {
        return {
          success: false,
          error: 'No subscription found',
        };
      }

      // Update status to cancelled
      await databaseService.updateSubscriptionStatus(
        userId,
        'cancelled',
        subscription.expiryDate || Date.now()
      );

      return { success: true };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Grant a test subscription (for testing purposes only)
   */
  async grantTestSubscription(
    userId: string,
    type: 'monthly' | 'annual'
  ): Promise<void> {
    const durationDays = type === 'annual' ? 365 : 30;
    const now = Date.now();
    const expiryDate = now + durationDays * 24 * 60 * 60 * 1000;

    const subscriptionData: SubscriptionData = {
      userId,
      subscriptionStatus: 'active',
      subscriptionType: type,
      purchaseToken: `test_token_${Date.now()}`,
      originalTransactionId: `test_txn_${userId}_${Date.now()}`,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      purchaseDate: now,
      expiryDate,
      isMock: true,
      createdAt: now,
      updatedAt: now,
    };

    await databaseService.saveSubscription(subscriptionData);
    console.log(`Granted test ${type} subscription for user:`, userId);
  }

  /**
   * Refresh subscription status (would verify with store in production)
   */
  async refreshSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    // In mock mode, just return current status
    // In production, this would verify the receipt with Apple/Google
    return await this.getSubscriptionStatus(userId);
  }
}

export const subscriptionService = new SubscriptionService();

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Purchases from 'react-native-purchases';
import { subscriptionService } from '../services/subscriptionService';
import { usageTrackingService } from '../services/usageTrackingService';
import { SubscriptionStatus, UsageStats } from '../types';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  isLoading: boolean;
  freeGenerationsRemaining: number;
  canGenerate: boolean;
  usageStats: UsageStats | null;

  purchaseSubscription: (productId: string, rcPackage?: any) => Promise<{
    success: boolean;
    error?: string;
    debug?: Record<string, unknown>;
  }>;
  restorePurchases: () => Promise<{
    success: boolean;
    restored: number;
    error?: string;
  }>;
  refreshStatus: () => Promise<void>;
  resetUsageForTesting: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [freeGenerationsRemaining, setFreeGenerationsRemaining] = useState(5);
  const [canGenerate, setCanGenerate] = useState(true);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isRevenueCatReady, setIsRevenueCatReady] = useState(false);

  // Initialize RevenueCat and load status when user changes
  useEffect(() => {
    if (user) {
      initRevenueCat(user.id);
    } else {
      subscriptionService.logOut();
      setSubscription(null);
      setFreeGenerationsRemaining(5);
      setCanGenerate(true);
      setUsageStats(null);
      setIsRevenueCatReady(false);
      setIsLoading(false);
    }
  }, [user]);

  // Listen for real-time subscription status changes from RevenueCat
  useEffect(() => {
    if (!user || !isRevenueCatReady) return;
    const onCustomerInfoUpdate = () => {
      loadSubscriptionStatus();
    };
    Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdate);
    };
  }, [user, isRevenueCatReady]);

  const initRevenueCat = async (userId: string) => {
    try {
      setIsLoading(true);
      const configured = await subscriptionService.configure(userId);
      if (configured) {
        await subscriptionService.identifyUser(userId);
      }
      setIsRevenueCatReady(configured);
      await loadSubscriptionStatus();
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
      setIsRevenueCatReady(false);
      setIsLoading(false);
    }
  };

  const loadSubscriptionStatus = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Load subscription status
      const subStatus = await subscriptionService.getSubscriptionStatus(user.id);
      setSubscription(subStatus);

      // Load free generations remaining
      const remaining = await usageTrackingService.getFreeGenerationsRemaining(user.id);
      setFreeGenerationsRemaining(remaining);

      // Check if user can generate
      const { canGenerate: canGen } = await usageTrackingService.canGenerateImage(user.id);
      setCanGenerate(canGen);

      // Load usage statistics
      const stats = await usageTrackingService.getUserUsageStats(user.id);
      setUsageStats(stats);
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseSubscription = async (
    productId: string,
    rcPackage?: any
  ): Promise<{ success: boolean; error?: string; debug?: Record<string, unknown> }> => {
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    try {
      setIsLoading(true);

      const result = await subscriptionService.purchaseSubscription(user.id, productId, rcPackage);

      if (result.success) {
        // Refresh subscription status after successful purchase
        await loadSubscriptionStatus();
      }

      return {
        success: result.success,
        error: result.error,
        debug: result.debug,
      };
    } catch (error) {
      console.error('Error purchasing subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          source: 'subscription_context',
          productId,
        },
      };
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async (): Promise<{
    success: boolean;
    restored: number;
    error?: string;
  }> => {
    if (!user) {
      return {
        success: false,
        restored: 0,
        error: 'User not authenticated',
      };
    }

    try {
      setIsLoading(true);

      const result = await subscriptionService.restorePurchases(user.id);

      if (result.success && result.restored > 0) {
        // Refresh subscription status after restoring
        await loadSubscriptionStatus();
      }

      return result;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return {
        success: false,
        restored: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = async (): Promise<void> => {
    await loadSubscriptionStatus();
  };

  const resetUsageForTesting = async (): Promise<void> => {
    if (!user) return;

    try {
      await usageTrackingService.resetUserUsage(user.id);
      await loadSubscriptionStatus();
      console.log('Usage reset for testing');
    } catch (error) {
      console.error('Error resetting usage for testing:', error);
    }
  };

  const value: SubscriptionContextType = {
    subscription,
    isLoading,
    freeGenerationsRemaining,
    canGenerate,
    usageStats,
    purchaseSubscription,
    restorePurchases,
    refreshStatus,
    resetUsageForTesting,
  };

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
};

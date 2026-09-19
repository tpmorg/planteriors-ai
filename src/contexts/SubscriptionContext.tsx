import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Purchases from 'react-native-purchases';
import { subscriptionService } from '../services/subscriptionService';
import { usageTrackingService } from '../services/usageTrackingService';
import { PurchaseCompletionEvent, SubscriptionStatus, UsageStats } from '../types';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  isLoading: boolean;
  freeGenerationsRemaining: number;
  canGenerate: boolean;
  usageStats: UsageStats | null;
  purchaseCompletion: PurchaseCompletionEvent | null;

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
  const [freeGenerationsRemaining, setFreeGenerationsRemaining] = useState(0);
  const [canGenerate, setCanGenerate] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isRevenueCatReady, setIsRevenueCatReady] = useState(false);
  const [purchaseCompletion, setPurchaseCompletion] = useState<PurchaseCompletionEvent | null>(null);

  // Initialize RevenueCat and load status when user changes
  useEffect(() => {
    if (user) {
      initRevenueCat(user.id);
    } else {
      subscriptionService.logOut();
      setSubscription(null);
      setFreeGenerationsRemaining(0);
      setCanGenerate(false);
      setUsageStats(null);
      setIsRevenueCatReady(false);
      setPurchaseCompletion(null);
      setIsLoading(false);
    }
  }, [user]);

  // Listen for real-time subscription status changes from RevenueCat
  useEffect(() => {
    if (!user || !isRevenueCatReady) return;
    const onCustomerInfoUpdate = () => {
      loadSubscriptionStatus(true);
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
      await loadSubscriptionStatus(true);
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
      setIsRevenueCatReady(false);
      setIsLoading(false);
    }
  };

  const loadSubscriptionStatus = async (refreshCredits: boolean = false) => {
    if (!user) return;

    try {
      setIsLoading(true);

      const [subStatus, remaining, stats] = await Promise.all([
        subscriptionService.getSubscriptionStatus(user.id),
        subscriptionService.getDesignCreditBalance(user.id, refreshCredits),
        usageTrackingService.getUserUsageStats(user.id),
      ]);
      setSubscription(subStatus);
      setFreeGenerationsRemaining(remaining);
      setCanGenerate(remaining > 0);
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
        await loadSubscriptionStatus(true);
        const purchaseKind = result.debug?.purchaseKind === 'room_pack' ? 'room_pack' : 'monthly';
        setPurchaseCompletion((current) => ({
          id: Math.max(Date.now(), (current?.id || 0) + 1),
          kind: purchaseKind,
          productId,
          completedAt: Date.now(),
        }));
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
        await loadSubscriptionStatus(true);
        setPurchaseCompletion((current) => ({
          id: Math.max(Date.now(), (current?.id || 0) + 1),
          kind: 'restore',
          completedAt: Date.now(),
        }));
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
    await loadSubscriptionStatus(true);
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
    purchaseCompletion,
    purchaseSubscription,
    restorePurchases,
    refreshStatus,
    resetUsageForTesting,
  };

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
};

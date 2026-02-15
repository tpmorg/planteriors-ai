import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PACKAGE_TYPE,
} from 'react-native-purchases';
import Constants from 'expo-constants';
import { SubscriptionProduct, SubscriptionStatus } from '../types';

const ENTITLEMENT_ID = 'premium';

class SubscriptionService {
  private isConfigured = false;

  /**
   * Initialize RevenueCat SDK. Call once at app startup after auth.
   */
  async configure(userId?: string): Promise<void> {
    if (this.isConfigured) return;

    const apiKey = Platform.select({
      ios: Constants.expoConfig?.extra?.revenueCatAppleApiKey,
      android: Constants.expoConfig?.extra?.revenueCatGoogleApiKey,
    });

    if (!apiKey) {
      console.error('RevenueCat API key not found for platform:', Platform.OS);
      return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({
      apiKey,
      appUserID: userId || undefined,
    });

    this.isConfigured = true;
  }

  /**
   * Identify user with RevenueCat (call after auth).
   */
  async identifyUser(userId: string): Promise<void> {
    try {
      await Purchases.logIn(userId);
    } catch (error) {
      console.error('RevenueCat identify error:', error);
    }
  }

  /**
   * Log out user from RevenueCat (call on sign-out).
   */
  async logOut(): Promise<void> {
    try {
      await Purchases.logOut();
    } catch (error) {
      console.error('RevenueCat logout error:', error);
    }
  }

  /**
   * Get available subscription products from RevenueCat offerings.
   */
  async getAvailableProducts(): Promise<SubscriptionProduct[]> {
    try {
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;

      if (!currentOffering) {
        console.warn('No current RevenueCat offering found');
        return [];
      }

      return currentOffering.availablePackages.map((pkg) =>
        this.mapPackageToProduct(pkg)
      );
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription package.
   */
  async purchaseSubscription(
    _userId: string,
    productId: string,
    rcPackage?: PurchasesPackage
  ): Promise<{
    success: boolean;
    subscription: SubscriptionStatus;
    error?: string;
  }> {
    try {
      if (!rcPackage) {
        const offerings = await Purchases.getOfferings();
        rcPackage = offerings.current?.availablePackages.find(
          (pkg) => pkg.product.identifier === productId
        );
      }

      if (!rcPackage) {
        return {
          success: false,
          subscription: this.defaultStatus(),
          error: 'Product not found',
        };
      }

      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      const status = this.mapCustomerInfoToStatus(customerInfo);

      return { success: status.isActive, subscription: status };
    } catch (error: any) {
      if (error.userCancelled) {
        return {
          success: false,
          subscription: this.defaultStatus(),
          error: 'Purchase cancelled',
        };
      }
      console.error('Purchase error:', error);
      return {
        success: false,
        subscription: this.defaultStatus(),
        error: error.message || 'Purchase failed',
      };
    }
  }

  /**
   * Get current subscription status from RevenueCat.
   */
  async getSubscriptionStatus(_userId: string): Promise<SubscriptionStatus> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return this.mapCustomerInfoToStatus(customerInfo);
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return this.defaultStatus();
    }
  }

  /**
   * Restore purchases via RevenueCat.
   */
  async restorePurchases(_userId: string): Promise<{
    success: boolean;
    restored: number;
    error?: string;
  }> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      return {
        success: true,
        restored: entitlement ? 1 : 0,
      };
    } catch (error: any) {
      return {
        success: false,
        restored: 0,
        error: error.message || 'Restore failed',
      };
    }
  }

  /**
   * Refresh subscription status from RevenueCat.
   */
  async refreshSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    return await this.getSubscriptionStatus(userId);
  }

  // --- Helper methods ---

  private mapPackageToProduct(pkg: PurchasesPackage): SubscriptionProduct {
    const product = pkg.product;
    const isAnnual = pkg.packageType === PACKAGE_TYPE.ANNUAL;

    return {
      id: product.identifier,
      name: isAnnual ? 'Premium Annual' : 'Premium Monthly',
      price: product.priceString,
      priceValue: product.price,
      currency: product.currencyCode,
      period: isAnnual ? 'year' : 'month',
      features: isAnnual
        ? ['Everything in Monthly', 'Save 33% vs monthly', 'Priority support']
        : ['Unlimited AI generations', 'Priority processing', 'HD image exports', 'Save unlimited designs'],
      savings: isAnnual ? 'BEST VALUE' : undefined,
      rcPackage: pkg,
    };
  }

  private mapCustomerInfoToStatus(customerInfo: CustomerInfo): SubscriptionStatus {
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (!entitlement) {
      return this.defaultStatus();
    }

    const isAnnual = entitlement.productIdentifier?.includes('annual');

    return {
      isActive: true,
      type: isAnnual ? 'annual' : 'monthly',
      expiryDate: entitlement.expirationDate
        ? new Date(entitlement.expirationDate).getTime()
        : null,
      isMock: false,
      platform: entitlement.store === 'PLAY_STORE' ? 'android' : 'ios',
      purchaseDate: entitlement.originalPurchaseDate
        ? new Date(entitlement.originalPurchaseDate).getTime()
        : undefined,
      entitlementId: ENTITLEMENT_ID,
    };
  }

  private defaultStatus(): SubscriptionStatus {
    return {
      isActive: false,
      type: null,
      expiryDate: null,
      isMock: false,
    };
  }
}

export const subscriptionService = new SubscriptionService();

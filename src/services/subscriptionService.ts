import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PACKAGE_TYPE,
} from 'react-native-purchases';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { SubscriptionProduct, SubscriptionStatus } from '../types';

const ENTITLEMENT_ID =
  Constants.expoConfig?.extra?.revenueCatEntitlementId ||
  Constants.expoConfig?.extra?.REVENUECAT_ENTITLEMENT_ID ||
  'Planterior Pro';

class SubscriptionService {
  private isConfigured = false;
  private didWarnMissingKey = false;

  private addRevenueCatBreadcrumb(
    message: string,
    data?: Record<string, unknown>,
    level: 'info' | 'warning' | 'error' = 'info'
  ) {
    Sentry.addBreadcrumb({
      category: 'revenuecat',
      message,
      level,
      data: {
        platform: Platform.OS,
        entitlementId: ENTITLEMENT_ID,
        ...data,
      },
    });
  }

  private captureRevenueCatMessage(
    message: string,
    level: 'info' | 'warning' | 'error',
    data?: Record<string, unknown>
  ) {
    Sentry.withScope((scope) => {
      scope.setTag('area', 'subscription');
      scope.setTag('platform', Platform.OS);
      scope.setContext('revenuecat', {
        entitlementId: ENTITLEMENT_ID,
        ...data,
      });
      Sentry.captureMessage(message, level);
    });
  }

  private captureRevenueCatException(
    message: string,
    error: unknown,
    data?: Record<string, unknown>
  ) {
    Sentry.withScope((scope) => {
      scope.setTag('area', 'subscription');
      scope.setTag('platform', Platform.OS);
      scope.setContext('revenuecat', {
        entitlementId: ENTITLEMENT_ID,
        ...data,
      });
      Sentry.captureException(error instanceof Error ? error : new Error(message));
    });
  }

  /**
   * Initialize RevenueCat SDK. Call once at app startup after auth.
   */
  async configure(userId?: string): Promise<boolean> {
    if (this.isConfigured) {
      this.addRevenueCatBreadcrumb('RevenueCat configure skipped; already configured', {
        hasUserId: !!userId,
      });
      return true;
    }

    const apiKey = Platform.select({
      ios: Constants.expoConfig?.extra?.revenueCatAppleApiKey,
      android: Constants.expoConfig?.extra?.revenueCatGoogleApiKey,
    });

    this.addRevenueCatBreadcrumb('RevenueCat configure requested', {
      hasUserId: !!userId,
      hasApiKey: !!apiKey,
      appEnv: Constants.expoConfig?.extra?.appEnv,
    });

    if (!apiKey) {
      if (!this.didWarnMissingKey) {
        this.didWarnMissingKey = true;
        console.warn('RevenueCat API key not found for platform:', Platform.OS);
        this.captureRevenueCatMessage('RevenueCat API key missing', 'warning', {
          hasUserId: !!userId,
          appEnv: Constants.expoConfig?.extra?.appEnv,
        });
      }
      return false;
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      this.captureRevenueCatMessage('RevenueCat unsupported platform', 'warning', {
        unsupportedPlatform: Platform.OS,
      });
      return false;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({
      apiKey,
      appUserID: userId || undefined,
    });

    this.isConfigured = true;
    this.addRevenueCatBreadcrumb('RevenueCat configured', {
      hasUserId: !!userId,
      appEnv: Constants.expoConfig?.extra?.appEnv,
    });
    return true;
  }

  private async ensureConfigured(userId?: string): Promise<boolean> {
    if (!this.isConfigured) {
      await this.configure(userId);
    }
    return this.isConfigured;
  }

  /**
   * Identify user with RevenueCat (call after auth).
   */
  async identifyUser(userId: string): Promise<void> {
    const ok = await this.ensureConfigured(userId);
    if (!ok) return;
    try {
      await Purchases.logIn(userId);
      this.addRevenueCatBreadcrumb('RevenueCat user identified', {
        hasUserId: !!userId,
      });
    } catch (error) {
      console.error('RevenueCat identify error:', error);
      this.captureRevenueCatException('RevenueCat identify failed', error, {
        hasUserId: !!userId,
      });
    }
  }

  /**
   * Log out user from RevenueCat (call on sign-out).
   */
  async logOut(): Promise<void> {
    const ok = await this.ensureConfigured();
    if (!ok) return;
    try {
      await Purchases.logOut();
      this.addRevenueCatBreadcrumb('RevenueCat user logged out');
    } catch (error) {
      console.error('RevenueCat logout error:', error);
      this.captureRevenueCatException('RevenueCat logout failed', error);
    }
  }

  /**
   * Get available subscription products from RevenueCat offerings.
   */
  async getAvailableProducts(): Promise<SubscriptionProduct[]> {
    const ok = await this.ensureConfigured();
    if (!ok) {
      this.captureRevenueCatMessage('RevenueCat products unavailable; SDK not configured', 'warning');
      return [];
    }
    try {
      this.addRevenueCatBreadcrumb('RevenueCat fetching offerings');
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      const allOfferingIds = Object.keys(offerings.all || {});

      if (!currentOffering) {
        console.warn('No current RevenueCat offering found');
        this.captureRevenueCatMessage('RevenueCat current offering missing', 'warning', {
          offeringIds: allOfferingIds,
        });
        return [];
      }

      const packageSummaries = currentOffering.availablePackages.map((pkg) => ({
        identifier: pkg.identifier,
        packageType: pkg.packageType,
        productIdentifier: pkg.product.identifier,
        priceString: pkg.product.priceString,
        currencyCode: pkg.product.currencyCode,
      }));

      this.addRevenueCatBreadcrumb('RevenueCat offering loaded', {
        currentOfferingIdentifier: currentOffering.identifier,
        offeringIds: allOfferingIds,
        packageCount: currentOffering.availablePackages.length,
        packages: packageSummaries,
      });

      if (currentOffering.availablePackages.length === 0) {
        this.captureRevenueCatMessage('RevenueCat current offering has no packages', 'warning', {
          currentOfferingIdentifier: currentOffering.identifier,
          offeringIds: allOfferingIds,
        });
        return [];
      }

      return currentOffering.availablePackages.map((pkg) =>
        this.mapPackageToProduct(pkg)
      );
    } catch (error) {
      console.error('Error fetching products:', error);
      this.captureRevenueCatException('RevenueCat product fetch failed', error);
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
    const ok = await this.ensureConfigured(_userId);
    if (!ok) {
      return {
        success: false,
        subscription: this.defaultStatus(),
        error: 'Purchases not available',
      };
    }
    try {
      if (!rcPackage) {
        this.addRevenueCatBreadcrumb('RevenueCat purchase package missing; refetching offerings', {
          productId,
        });
        const offerings = await Purchases.getOfferings();
        rcPackage = offerings.current?.availablePackages.find(
          (pkg) => pkg.product.identifier === productId
        );
      }

      if (!rcPackage) {
        this.captureRevenueCatMessage('RevenueCat purchase product not found', 'warning', {
          productId,
        });
        return {
          success: false,
          subscription: this.defaultStatus(),
          error: 'Product not found',
        };
      }

      this.addRevenueCatBreadcrumb('RevenueCat purchase started', {
        productId,
        packageIdentifier: rcPackage.identifier,
        packageType: rcPackage.packageType,
      });
      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      const status = this.mapCustomerInfoToStatus(customerInfo);
      this.addRevenueCatBreadcrumb('RevenueCat purchase completed', {
        productId,
        isActive: status.isActive,
        type: status.type,
      });

      return { success: status.isActive, subscription: status };
    } catch (error: any) {
      if (error.userCancelled) {
        this.addRevenueCatBreadcrumb('RevenueCat purchase cancelled', {
          productId,
        });
        return {
          success: false,
          subscription: this.defaultStatus(),
          error: 'Purchase cancelled',
        };
      }
      console.error('Purchase error:', error);
      this.captureRevenueCatException('RevenueCat purchase failed', error, {
        productId,
      });
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
    const ok = await this.ensureConfigured(_userId);
    if (!ok) {
      this.captureRevenueCatMessage('RevenueCat status unavailable; SDK not configured', 'warning', {
        hasUserId: !!_userId,
      });
      return this.defaultStatus();
    }
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const status = this.mapCustomerInfoToStatus(customerInfo);
      this.addRevenueCatBreadcrumb('RevenueCat customer info loaded', {
        activeEntitlementIds: Object.keys(customerInfo.entitlements.active || {}),
        expectedEntitlementId: ENTITLEMENT_ID,
        isActive: status.isActive,
        type: status.type,
      });
      return status;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      this.captureRevenueCatException('RevenueCat customer info fetch failed', error, {
        hasUserId: !!_userId,
      });
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
    const ok = await this.ensureConfigured(_userId);
    if (!ok) {
      return {
        success: false,
        restored: 0,
        error: 'Purchases not available',
      };
    }
    try {
      const customerInfo = await Purchases.restorePurchases();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      this.addRevenueCatBreadcrumb('RevenueCat restore completed', {
        restored: !!entitlement,
        activeEntitlementIds: Object.keys(customerInfo.entitlements.active || {}),
      });
      return {
        success: true,
        restored: entitlement ? 1 : 0,
      };
    } catch (error: any) {
      this.captureRevenueCatException('RevenueCat restore failed', error, {
        hasUserId: !!_userId,
      });
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

    this.addRevenueCatBreadcrumb('RevenueCat package mapped to subscription product', {
      packageIdentifier: pkg.identifier,
      packageType: pkg.packageType,
      productIdentifier: product.identifier,
      priceString: product.priceString,
      currencyCode: product.currencyCode,
    });

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
      this.addRevenueCatBreadcrumb('RevenueCat expected entitlement inactive', {
        expectedEntitlementId: ENTITLEMENT_ID,
        activeEntitlementIds: Object.keys(customerInfo.entitlements.active || {}),
        allEntitlementIds: Object.keys(customerInfo.entitlements.all || {}),
      }, 'warning');
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

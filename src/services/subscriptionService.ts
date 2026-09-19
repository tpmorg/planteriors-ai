import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { SubscriptionProduct, SubscriptionStatus } from '../types';

const ENTITLEMENT_ID =
  Constants.expoConfig?.extra?.revenueCatEntitlementId ||
  Constants.expoConfig?.extra?.REVENUECAT_ENTITLEMENT_ID ||
  'Planterior Pro';
const DESIGN_CURRENCY_CODE = 'DESIGNS';

class SubscriptionService {
  private isConfigured = false;
  private didWarnMissingKey = false;

  getDiagnostics(): Record<string, unknown> {
    return this.getRuntimeDiagnostics();
  }

  async debugOfferings(userId?: string): Promise<Record<string, unknown>> {
    const requestedAt = new Date().toISOString();
    const runtime = this.getRuntimeDiagnostics();
    const ok = await this.ensureConfigured(userId);

    if (!ok) {
      return {
        ok: false,
        requestedAt,
        runtime,
        error: 'RevenueCat SDK is not configured',
      };
    }

    try {
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      const offeringIds = Object.keys(offerings.all || {});
      const packages = currentOffering?.availablePackages.map((pkg) => {
        const product = pkg.product as unknown as Record<string, unknown>;

        return {
          packageIdentifier: pkg.identifier,
          packageType: pkg.packageType,
          productIdentifier: pkg.product.identifier,
          productTitle: product.title,
          productDescription: product.description,
          productPrice: product.price,
          productPriceString: product.priceString,
          currencyCode: product.currencyCode,
          subscriptionPeriod: product.subscriptionPeriod,
          productCategory: product.productCategory,
          productType: product.productType,
        };
      }) || [];

      const payload = {
        ok: true,
        requestedAt,
        runtime,
        currentOfferingIdentifier: currentOffering?.identifier || null,
        offeringIds,
        packageCount: packages.length,
        packages,
      };

      this.captureRevenueCatMessage('RevenueCat offerings debug completed', 'warning', payload);
      return payload;
    } catch (error) {
      const payload = {
        ok: false,
        requestedAt,
        runtime,
        error: this.serializeError(error),
      };
      this.captureRevenueCatException('RevenueCat offerings debug failed', error, payload);
      return payload;
    }
  }

  async debugSubscriptionState(userId?: string): Promise<Record<string, unknown>> {
    const requestedAt = new Date().toISOString();
    const runtime = this.getRuntimeDiagnostics();
    const ok = await this.ensureConfigured(userId);
    const appUserID = await this.getCurrentAppUserId();

    if (!ok) {
      return {
        ok: false,
        requestedAt,
        runtime,
        requestedUserId: userId,
        appUserID,
        error: 'RevenueCat SDK is not configured',
      };
    }

    try {
      const [offerings, customerInfo] = await Promise.all([
        Purchases.getOfferings(),
        Purchases.getCustomerInfo(),
      ]);
      const currentOffering = offerings.current;
      const packages = currentOffering?.availablePackages.map((pkg) => ({
        packageIdentifier: pkg.identifier,
        packageType: pkg.packageType,
        productIdentifier: pkg.product.identifier,
      })) || [];
      const activeEntitlementIds = Object.keys(customerInfo.entitlements.active || {});
      const expectedEntitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      const originalAppUserId = (customerInfo as CustomerInfo & { originalAppUserId?: string })
        .originalAppUserId;
      const payload = {
        ok: true,
        requestedAt,
        runtime,
        requestedUserId: userId,
        appUserID,
        originalAppUserId,
        expectedEntitlementId: ENTITLEMENT_ID,
        hasExpectedEntitlement: !!expectedEntitlement,
        activeEntitlementIds,
        allEntitlementIds: Object.keys(customerInfo.entitlements.all || {}),
        activeSubscriptions: customerInfo.activeSubscriptions,
        allPurchasedProductIdentifiers: customerInfo.allPurchasedProductIdentifiers,
        currentOfferingIdentifier: currentOffering?.identifier || null,
        packageCount: packages.length,
        packages,
      };

      this.captureRevenueCatMessage('RevenueCat subscription sanity check completed', 'warning', payload);
      return payload;
    } catch (error) {
      const payload = {
        ok: false,
        requestedAt,
        runtime,
        requestedUserId: userId,
        appUserID,
        error: this.serializeError(error),
      };
      this.captureRevenueCatException('RevenueCat subscription sanity check failed', error, payload);
      return payload;
    }
  }

  private getRuntimeDiagnostics(): Record<string, unknown> {
    const constants = Constants as any;
    const extra = Constants.expoConfig?.extra || {};
    const apiKey = Platform.select({
      ios: extra.revenueCatIosApiKeyProduction,
      android: extra.revenueCatGoogleApiKeyProduction,
    });

    return {
      platform: Platform.OS,
      appEnv: extra.appEnv,
      appVersion: Constants.expoConfig?.version,
      runtimeVersion: Constants.expoConfig?.runtimeVersion,
      nativeBuildVersion: constants.nativeBuildVersion,
      applicationId: constants.applicationId,
      appOwnership: constants.appOwnership,
      executionEnvironment: constants.executionEnvironment,
      hasRevenueCatApiKey: !!apiKey,
      revenueCatApiKeyPrefix: typeof apiKey === 'string' ? apiKey.slice(0, 5) : undefined,
      entitlementId: ENTITLEMENT_ID,
    };
  }

  private serializeError(error: unknown): Record<string, unknown> {
    if (!error || typeof error !== 'object') {
      return { message: String(error) };
    }

    const errorRecord = error as Record<string, unknown>;
    return {
      name: errorRecord.name,
      message: errorRecord.message,
      code: errorRecord.code,
      readableErrorCode: errorRecord.readableErrorCode,
      underlyingErrorMessage: errorRecord.underlyingErrorMessage,
      userCancelled: errorRecord.userCancelled,
    };
  }

  private async getCurrentAppUserId(): Promise<string | undefined> {
    try {
      return await Purchases.getAppUserID();
    } catch {
      return undefined;
    }
  }

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
        runtime: this.getRuntimeDiagnostics(),
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
        runtime: this.getRuntimeDiagnostics(),
        error: this.serializeError(error),
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
      ios: Constants.expoConfig?.extra?.revenueCatIosApiKeyProduction,
      android: Constants.expoConfig?.extra?.revenueCatGoogleApiKeyProduction,
    });

    this.addRevenueCatBreadcrumb('RevenueCat configure requested', {
      hasUserId: !!userId,
      hasApiKey: !!apiKey,
      runtime: this.getRuntimeDiagnostics(),
    });

    if (!apiKey) {
      if (!this.didWarnMissingKey) {
        this.didWarnMissingKey = true;
        console.warn('RevenueCat API key not found for platform:', Platform.OS);
        this.captureRevenueCatMessage('RevenueCat API key missing', 'warning', {
          hasUserId: !!userId,
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
      runtime: this.getRuntimeDiagnostics(),
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

  /** Get the monthly plan and one-time credit pack from RevenueCat. */
  async getAvailableProducts(): Promise<SubscriptionProduct[]> {
    const ok = await this.ensureConfigured();
    if (!ok) {
      this.captureRevenueCatMessage('RevenueCat products unavailable; SDK not configured', 'warning');
      return [];
    }
    try {
      this.addRevenueCatBreadcrumb('RevenueCat fetching offerings');
      this.captureRevenueCatMessage('RevenueCat offerings fetch started', 'warning', {
        runtime: this.getRuntimeDiagnostics(),
      });
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
        runtime: this.getRuntimeDiagnostics(),
      });
      this.captureRevenueCatMessage('RevenueCat offering loaded', 'warning', {
        currentOfferingIdentifier: currentOffering.identifier,
        offeringIds: allOfferingIds,
        packageCount: currentOffering.availablePackages.length,
        packages: packageSummaries,
        runtime: this.getRuntimeDiagnostics(),
      });

      if (currentOffering.availablePackages.length === 0) {
        this.captureRevenueCatMessage('RevenueCat current offering has no packages', 'warning', {
          currentOfferingIdentifier: currentOffering.identifier,
          offeringIds: allOfferingIds,
          runtime: this.getRuntimeDiagnostics(),
        });
        return [];
      }

      return currentOffering.availablePackages.map((pkg) =>
        this.mapPackageToProduct(pkg)
      );
    } catch (error) {
      console.error('Error fetching products:', error);
      this.captureRevenueCatException('RevenueCat product fetch failed', error, {
        runtime: this.getRuntimeDiagnostics(),
      });
      return [];
    }
  }

  /** Read the design-credit balance directly from the RevenueCat SDK. */
  async getDesignCreditBalance(userId?: string, refresh: boolean = false): Promise<number> {
    const ok = await this.ensureConfigured(userId);
    if (!ok) return 0;

    try {
      if (refresh) {
        await Purchases.invalidateVirtualCurrenciesCache();
      }
      const currencies = await Purchases.getVirtualCurrencies();
      return Math.max(0, Number(currencies.all?.[DESIGN_CURRENCY_CODE]?.balance || 0));
    } catch (error) {
      console.error('RevenueCat design credit fetch failed:', error);
      this.captureRevenueCatException('RevenueCat design credit fetch failed', error, {
        currencyCode: DESIGN_CURRENCY_CODE,
      });
      try {
        const cachedCurrencies = await Purchases.getCachedVirtualCurrencies();
        return Math.max(0, Number(cachedCurrencies?.all?.[DESIGN_CURRENCY_CODE]?.balance || 0));
      } catch {
        return 0;
      }
    }
  }

  /** Purchase either the monthly plan or a one-time room pack. */
  async purchaseSubscription(
    _userId: string,
    productId: string,
    rcPackage?: PurchasesPackage
  ): Promise<{
    success: boolean;
    subscription: SubscriptionStatus;
    error?: string;
    debug?: Record<string, unknown>;
  }> {
    const ok = await this.ensureConfigured(_userId);
    const appUserID = await this.getCurrentAppUserId();
    const getPurchaseDebug = () => ({
      requestedUserId: _userId,
      appUserID,
      productId,
      packageIdentifier: rcPackage?.identifier,
      packageType: rcPackage?.packageType,
      storeProductId: rcPackage?.product.identifier,
    });

    if (!ok) {
      return {
        success: false,
        subscription: this.defaultStatus(),
        error: 'Purchases not available',
        debug: {
          ...getPurchaseDebug(),
          source: 'revenuecat_config',
        },
      };
    }

    try {
      if (!rcPackage) {
        this.addRevenueCatBreadcrumb('RevenueCat purchase package missing; refetching offerings', {
          productId,
          requestedUserId: _userId,
          appUserID,
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
          debug: {
            ...getPurchaseDebug(),
            source: 'revenuecat_offerings',
          },
        };
      }

      this.addRevenueCatBreadcrumb('RevenueCat purchase started', {
        requestedUserId: _userId,
        appUserID,
        productId,
        packageIdentifier: rcPackage.identifier,
        packageType: rcPackage.packageType,
        storeProductId: rcPackage.product.identifier,
      });
      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      const originalAppUserId = (customerInfo as CustomerInfo & { originalAppUserId?: string })
        .originalAppUserId;
      const status = this.mapCustomerInfoToStatus(customerInfo);
      const isRoomPack = this.isRoomPack(rcPackage);
      let designCreditBalance: number | undefined;

      if (isRoomPack) {
        try {
          await Purchases.invalidateVirtualCurrenciesCache();
          const currencies = await Purchases.getVirtualCurrencies() as unknown as {
            all?: Record<string, { balance?: number }>;
          };
          designCreditBalance = currencies.all?.DESIGNS?.balance;
        } catch (creditError) {
          this.captureRevenueCatException('RevenueCat design credit refresh failed', creditError, {
            productId,
          });
        }
      }

      const purchaseSucceeded = isRoomPack || status.isActive;
      this.addRevenueCatBreadcrumb('RevenueCat purchase completed', {
        requestedUserId: _userId,
        appUserID,
        productId,
        isActive: status.isActive,
        type: status.type,
        originalAppUserId,
        activeEntitlementIds: Object.keys(customerInfo.entitlements.active || {}),
        allEntitlementIds: Object.keys(customerInfo.entitlements.all || {}),
        activeSubscriptions: customerInfo.activeSubscriptions,
        allPurchasedProductIdentifiers: customerInfo.allPurchasedProductIdentifiers,
        purchaseKind: isRoomPack ? 'room_pack' : 'monthly',
        designCreditBalance,
      });

      return {
        success: purchaseSucceeded,
        subscription: status,
        error: purchaseSucceeded ? undefined : 'Purchase completed, but no active monthly entitlement was returned.',
        debug: {
          ...getPurchaseDebug(),
          source: 'revenuecat_customer_info',
          originalAppUserId,
          activeEntitlementIds: Object.keys(customerInfo.entitlements.active || {}),
          allEntitlementIds: Object.keys(customerInfo.entitlements.all || {}),
          activeSubscriptions: customerInfo.activeSubscriptions,
          allPurchasedProductIdentifiers: customerInfo.allPurchasedProductIdentifiers,
          purchaseKind: isRoomPack ? 'room_pack' : 'monthly',
          designCreditBalance,
        },
      };
    } catch (error: any) {
      if (error.userCancelled) {
        this.addRevenueCatBreadcrumb('RevenueCat purchase cancelled', {
          productId,
          requestedUserId: _userId,
          appUserID,
        });
        return {
          success: false,
          subscription: this.defaultStatus(),
          error: 'Purchase cancelled',
          debug: {
            ...getPurchaseDebug(),
            source: 'storekit_user_cancelled',
            error: this.serializeError(error),
          },
        };
      }
      console.error('Purchase error:', error);
      this.captureRevenueCatException('RevenueCat purchase failed', error, {
        requestedUserId: _userId,
        appUserID,
        productId,
        packageIdentifier: rcPackage?.identifier,
        packageType: rcPackage?.packageType,
        storeProductId: rcPackage?.product.identifier,
      });
      return {
        success: false,
        subscription: this.defaultStatus(),
        error: error.message || error.underlyingErrorMessage || error.readableErrorCode || 'RevenueCat purchase failed',
        debug: {
          ...getPurchaseDebug(),
          source: 'revenuecat_purchase',
          error: this.serializeError(error),
        },
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
    const isRoomPack = this.isRoomPack(pkg);

    this.addRevenueCatBreadcrumb('RevenueCat package mapped to subscription product', {
      packageIdentifier: pkg.identifier,
      packageType: pkg.packageType,
      productIdentifier: product.identifier,
      priceString: product.priceString,
      currencyCode: product.currencyCode,
    });

    return {
      id: product.identifier,
      name: isRoomPack ? 'One-time Room Pack' : 'Monthly Plan',
      price: product.priceString,
      priceValue: product.price,
      currency: product.currencyCode,
      kind: isRoomPack ? 'room_pack' : 'monthly',
      period: isRoomPack ? 'one_time' : 'month',
      designCredits: isRoomPack ? 20 : 30,
      features: isRoomPack
        ? ['20 plant designs', 'Credits never expire', 'No subscription']
        : ['30 plant designs each month', 'Credits refresh every billing cycle', 'Cancel anytime'],
      savings: isRoomPack ? 'NO EXPIRY' : undefined,
      rcPackage: pkg,
    };
  }

  private isRoomPack(pkg: PurchasesPackage): boolean {
    const packageId = pkg.identifier.toLowerCase();
    const productId = pkg.product.identifier.toLowerCase();
    return packageId.includes('room_pack') || productId.includes('roompack') || productId.includes('room_pack');
  }

  private mapCustomerInfoToStatus(customerInfo: CustomerInfo): SubscriptionStatus {
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    const hasPurchased = customerInfo.allPurchasedProductIdentifiers.length > 0;

    if (!entitlement) {
      this.addRevenueCatBreadcrumb('RevenueCat expected entitlement inactive', {
        expectedEntitlementId: ENTITLEMENT_ID,
        activeEntitlementIds: Object.keys(customerInfo.entitlements.active || {}),
        allEntitlementIds: Object.keys(customerInfo.entitlements.all || {}),
      }, 'warning');
      return { ...this.defaultStatus(), isVerified: true, hasPurchased };
    }

    const isAnnual = entitlement.productIdentifier?.includes('annual');

    return {
      isActive: true,
      isVerified: true,
      hasPurchased: true,
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
      isVerified: false,
      hasPurchased: false,
      type: null,
      expiryDate: null,
      isMock: false,
    };
  }
}

export const subscriptionService = new SubscriptionService();

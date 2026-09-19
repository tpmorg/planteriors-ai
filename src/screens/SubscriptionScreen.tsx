import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import { useNavigation } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { useNetworkGuard } from '../contexts/NetworkContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { subscriptionService } from '../services/subscriptionService';
import { SubscriptionProduct } from '../types';

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const requireNetwork = useNetworkGuard();
  const { purchaseSubscription, restorePurchases, subscription } = useSubscription();
  const styles = createStyles(theme);

  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isPurchasing, setPurchasing] = useState(false);
  const [isRestoring, setRestoring] = useState(false);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);

  const selectedProduct = products.find((product) => product.id === selectedProductId);

  const formatPurchaseFailureDebug = (
    debug?: Record<string, unknown>
  ): string => {
    if (!debug) return '';

    const diagnostics = subscriptionService.getDiagnostics();
    const fields = {
      expectedEntitlementId: diagnostics.entitlementId,
      source: debug.source,
      requestedProductId: debug.productId,
      storeProductId: debug.storeProductId,
      packageIdentifier: debug.packageIdentifier,
      appUserID: debug.appUserID,
      originalAppUserId: debug.originalAppUserId,
      activeEntitlementIds: debug.activeEntitlementIds,
      allEntitlementIds: debug.allEntitlementIds,
      activeSubscriptions: debug.activeSubscriptions,
      allPurchasedProductIdentifiers: debug.allPurchasedProductIdentifiers,
    };

    return `\n\nDebug:\n${JSON.stringify(fields, null, 2)}`;
  };

  useEffect(() => {
    captureSubscriptionScreenMessage('Subscription screen opened', 'warning', {
      runtime: subscriptionService.getDiagnostics(),
    });
    loadProducts();
  }, []);

  const captureSubscriptionScreenMessage = (
    message: string,
    level: 'info' | 'warning' | 'error',
    context?: Record<string, unknown>
  ) => {
    Sentry.withScope((scope) => {
      scope.setTag('area', 'subscription');
      scope.setTag('subscription_screen_event', message);
      scope.setContext('subscription_screen', {
        runtime: subscriptionService.getDiagnostics(),
        ...context,
      });
      Sentry.captureMessage(message, level);
    });
  };

  const captureSubscriptionScreenException = async (
    message: string,
    context?: Record<string, unknown>
  ) => {
    Sentry.withScope((scope) => {
      scope.setTag('area', 'subscription');
      scope.setTag('subscription_screen_event', message);
      scope.setContext('subscription_screen', {
        runtime: subscriptionService.getDiagnostics(),
        ...context,
      });
      Sentry.captureException(new Error(message));
    });

    try {
      await Sentry.flush();
    } catch (error) {
      console.warn('Sentry flush failed after subscription exception:', error);
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Unable to Open Link', 'Please try again later.');
    }
  };

  useEffect(() => {
    if (!hasLoadedProducts || selectedProductId) return;

    Sentry.withScope((scope) => {
      scope.setTag('area', 'subscription');
      scope.setTag('subscription_button_disabled_reason', 'no_selected_product');
      scope.setContext('subscription_screen', {
        productCount: products.length,
        productIds: products.map((product) => product.id),
        selectedProductId,
        isPurchasing,
        runtime: subscriptionService.getDiagnostics(),
      });
      Sentry.captureMessage('Subscription button disabled after product load', 'warning');
    });
  }, [hasLoadedProducts, isPurchasing, products, selectedProductId]);

  const loadProducts = async () => {
    if (!requireNetwork('Please connect to the internet to load subscription plans.')) {
      captureSubscriptionScreenMessage('Subscription products blocked by network guard', 'warning', {
        reason: 'network_unavailable',
      });
      Sentry.addBreadcrumb({
        category: 'subscription',
        message: 'Subscription products not loaded; network unavailable',
        level: 'warning',
        data: {
          runtime: subscriptionService.getDiagnostics(),
        },
      });
      setProducts([]);
      setSelectedProductId(null);
      setProductLoadError('Connect to the internet to load subscription plans.');
      setHasLoadedProducts(true);
      return;
    }

    Sentry.addBreadcrumb({
      category: 'subscription',
      message: 'Subscription screen loading products',
      level: 'info',
      data: {
        runtime: subscriptionService.getDiagnostics(),
      },
    });
    captureSubscriptionScreenMessage('Subscription products load started', 'warning', {
      runtime: subscriptionService.getDiagnostics(),
    });

    setHasLoadedProducts(false);
    setProductLoadError(null);
    setSelectedProductId(null);
    const availableProducts = await subscriptionService.getAvailableProducts();

    setProducts(availableProducts);
    setHasLoadedProducts(true);
    captureSubscriptionScreenMessage('Subscription products load completed', 'warning', {
      revenueCatProductCount: availableProducts.length,
      displayProductCount: availableProducts.length,
      revenueCatProductIds: availableProducts.map((product) => product.id),
      displayProductIds: availableProducts.map((product) => product.id),
      selectedProductIdBeforeDefault: selectedProductId,
    });

    Sentry.addBreadcrumb({
      category: 'subscription',
      message: 'Subscription screen products loaded',
      level: availableProducts.length > 0 ? 'info' : 'warning',
      data: {
        productCount: availableProducts.length,
        productIds: availableProducts.map((product) => product.id),
        runtime: subscriptionService.getDiagnostics(),
      },
    });

    if (availableProducts.length === 0) {
      const message = 'Subscription plans unavailable: RevenueCat returned no purchasable packages';
      setProductLoadError('Subscription plans are unavailable right now. Please try again.');
      console.error(message, {
        runtime: subscriptionService.getDiagnostics(),
      });
      await captureSubscriptionScreenException(message, {
        productCount: 0,
        selectedProductId,
      });
      return;
    }

    // The monthly plan is the primary recurring option.
    if (availableProducts.length > 0) {
      const defaultProductId =
        availableProducts.find((product) => product.kind === 'monthly')?.id ||
        availableProducts[0].id;
      setSelectedProductId(defaultProductId);
      captureSubscriptionScreenMessage('Subscription default product selected', 'warning', {
        selectedProductId: defaultProductId,
      });
      Sentry.addBreadcrumb({
        category: 'subscription',
        message: 'Subscription screen selected default product',
        level: 'info',
        data: {
          selectedProductId: defaultProductId,
        },
      });
    }
  };

  const handlePurchase = async () => {
    if (!requireNetwork('Please connect to the internet to make a purchase.')) {
      Sentry.addBreadcrumb({
        category: 'subscription',
        message: 'Subscription purchase blocked; network unavailable',
        level: 'warning',
        data: {
          productCount: products.length,
          selectedProductId,
        },
      });
      return;
    }

    if (!selectedProductId) {
      Sentry.withScope((scope) => {
        scope.setTag('area', 'subscription');
        scope.setContext('subscription_screen', {
          productCount: products.length,
          productIds: products.map((product) => product.id),
          selectedProductId,
        });
        Sentry.captureMessage('Subscription purchase tapped without selected product', 'warning');
      });
      Alert.alert('Error', 'Please select a plan');
      return;
    }

    const selectedProduct = products.find(p => p.id === selectedProductId);
    if (!selectedProduct?.rcPackage) {
      await captureSubscriptionScreenException('Subscription purchase blocked: selected product has no RevenueCat package', {
        selectedProductId,
        hasSelectedProduct: !!selectedProduct,
        hasRevenueCatPackage: !!selectedProduct?.rcPackage,
        productIds: products.map((product) => product.id),
      });
      Sentry.addBreadcrumb({
        category: 'subscription',
        message: 'Subscription purchase blocked; selected product has no RevenueCat package',
        level: 'warning',
        data: {
          selectedProductId,
        },
      });
      Alert.alert(
        'Purchase Unavailable',
        'We could not load this product from the store. Please try again.'
      );
      return;
    }

    setPurchasing(true);

    try {
      Sentry.addBreadcrumb({
        category: 'subscription',
        message: 'Subscription purchase submitted from screen',
        level: 'info',
        data: {
          selectedProductId,
          hasRevenueCatPackage: !!selectedProduct?.rcPackage,
          productCount: products.length,
        },
      });
      const result = await purchaseSubscription(selectedProductId, selectedProduct?.rcPackage);

      if (result.success) {
        const isRoomPack = selectedProduct.kind === 'room_pack';
        Alert.alert(
          'Success!',
          isRoomPack
            ? '20 design credits were added to your account. They do not expire.'
            : 'Your monthly plan is active with 30 designs per billing cycle.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        const failureMessage =
          result.error ||
          'Purchase failed before RevenueCat returned an error message. Please try again.';
        Sentry.withScope((scope) => {
          scope.setTag('area', 'subscription');
          scope.setTag('purchase_failure_source', String(result.debug?.source || 'unknown'));
          scope.setContext('subscription_purchase_failure', {
            selectedProductId,
            error: result.error,
            debug: result.debug,
          });
          Sentry.captureMessage('Subscription purchase failed from screen', 'warning');
        });
        Sentry.addBreadcrumb({
          category: 'subscription',
          message: 'Subscription purchase failed from context',
          level: 'warning',
          data: {
            selectedProductId,
            error: failureMessage,
            source: result.debug?.source,
          },
        });
        Alert.alert(
          'Purchase Failed',
          `${failureMessage}${formatPurchaseFailureDebug(result.debug)}`
        );
      }
    } catch (error) {
      Sentry.captureException(error instanceof Error ? error : new Error('Subscription purchase screen error'));
      Alert.alert('Error', 'Failed to process purchase');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!requireNetwork('Please connect to the internet to restore purchases.')) {
      return;
    }

    setRestoring(true);

    try {
      const result = await restorePurchases();

      if (result.success && result.restored > 0) {
        Alert.alert(
          'Restored!',
          `Successfully restored ${result.restored} purchase(s)`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else if (result.success) {
        Alert.alert('No Purchases Found', 'No previous purchases to restore');
      } else {
        Alert.alert('Restore Failed', result.error || 'Unable to restore purchases');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />
      <View style={styles.header}>
        <AppButton
          variant="icon"
          icon="X"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close"
          style={styles.closeButton}
          hitSlop={10}
          testID="subscription-close"
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Choose How You Create</Text>
          <Text style={styles.subtitle}>
            Get 30 designs each month or buy 20 that never expire
          </Text>
        </View>

        {subscription?.isActive && (
          <View style={styles.currentPlanBadge}>
            <AppIcon name="CheckCircle" size={20} color={theme.colors.primary} />
            <Text style={styles.currentPlanText}>
              Current Plan: {subscription.type === 'annual' ? 'Legacy Annual' : 'Monthly — 30 designs'}
            </Text>
          </View>
        )}

        <View style={styles.plansSection}>
          {!hasLoadedProducts ? (
            <View style={styles.statusCard}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.statusTitle}>Loading Plans</Text>
            </View>
          ) : productLoadError ? (
            <View style={styles.statusCard}>
              <AppIcon name="WarningCircle" size={28} color={theme.colors.textSecondary} />
              <Text style={styles.statusTitle}>Plans Unavailable</Text>
              <Text style={styles.statusText}>{productLoadError}</Text>
              <AppButton
                variant="primary"
                size="sm"
                title="Retry"
                onPress={loadProducts}
                style={styles.retryButton}
                testID="subscription-retry"
              />
            </View>
          ) : (
            products.map((product) => (
              <PlanCard
                key={product.id}
                product={product}
                isSelected={selectedProductId === product.id}
                onSelect={() => setSelectedProductId(product.id)}
                theme={theme}
                isCurrentPlan={!!(subscription?.isActive && product.kind === 'monthly')}
              />
            ))
          )}
        </View>

        {!productLoadError && (
          <AppButton
            variant="secondary"
            title="Restore Purchases"
            loading={isRestoring}
            onPress={handleRestorePurchases}
            style={styles.restoreButton}
            testID="subscription-restore"
          />
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By purchasing, you agree to our{' '}
            <Text
              style={styles.footerLink}
              onPress={() => openExternalLink('https://planterior.app/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.footerLink}
              onPress={() => openExternalLink('https://planterior.app/privacy')}
            >
              Privacy Policy
            </Text>
            . Monthly plans renew automatically unless canceled at least 24 hours before the end
            of the current period. Room Pack purchases are one-time and do not expire. Payment is
            charged to your store account at confirmation of purchase.
          </Text>
        </View>
      </ScrollView>

      {!productLoadError ? (
        <View style={styles.stickyFooter}>
          <AppButton
            variant="primary"
            size="lg"
            elevated
            icon="CreditCard"
            loading={isPurchasing}
            disabled={!selectedProductId}
            title={selectedProduct?.kind === 'room_pack' ? 'Buy Room Pack' : 'Subscribe Monthly'}
            onPress={handlePurchase}
            testID="subscription-purchase"
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
};

interface PlanCardProps {
  product: SubscriptionProduct;
  isSelected: boolean;
  onSelect: () => void;
  theme: any;
  isCurrentPlan: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({
  product,
  isSelected,
  onSelect,
  theme,
  isCurrentPlan,
}) => {
  const isRoomPack = product.kind === 'room_pack';

  return (
    <TouchableOpacity
      style={[
        {
          backgroundColor: theme.isDark ? theme.colors.card : theme.colors.surface,
          borderRadius: 20,
          padding: 20,
          borderWidth: 2,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          marginBottom: 14,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: theme.isDark ? 0.24 : 0.08,
          shadowRadius: 12,
          elevation: 3,
        },
        isCurrentPlan && { opacity: 0.7 },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
      disabled={isCurrentPlan}
    >
      {isRoomPack && (
        <View
          style={{
            position: 'absolute',
            top: -12,
            right: 20,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 14,
            paddingVertical: 5,
            borderRadius: 14,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: theme.colors.surface,
              letterSpacing: 0.3,
            }}
          >
            NO EXPIRY
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 4,
            }}
          >
            {product.name}
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: theme.colors.primary,
              marginBottom: 8,
            }}
          >
            {product.price}
          </Text>
          {product.savings && (
            <Text
              style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginBottom: 12,
              }}
            >
              {product.savings}
            </Text>
          )}
        </View>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isSelected ? theme.colors.primary : 'transparent',
          }}
        >
          {isSelected && (
            <AppIcon name="Check" size={16} color={theme.colors.surface} />
          )}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {product.features.map((feature, index) => (
          <View
            key={index}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <AppIcon name="CheckCircle" size={18} color={theme.colors.primary} />
            <Text
              style={{
                fontSize: 15,
                color: theme.colors.text,
                lineHeight: 20,
              }}
            >
              {feature}
            </Text>
          </View>
        ))}
      </View>

      {isCurrentPlan && (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: theme.colors.textSecondary,
              fontStyle: 'italic',
            }}
          >
            Current Active Plan
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backdropBlobA: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: theme.isDark ? 'rgba(143,179,154,0.12)' : 'rgba(78,107,87,0.11)',
      top: -80,
      left: -80,
    },
    backdropBlobB: {
      position: 'absolute',
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: theme.isDark ? 'rgba(181,122,82,0.08)' : 'rgba(181,122,82,0.08)',
      bottom: -140,
      right: -100,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    closeButton: {
      backgroundColor: theme.isDark ? 'rgba(31,36,33,0.8)' : 'rgba(255,255,255,0.9)',
      borderColor: theme.colors.border,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 40,
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: 28,
      paddingVertical: 28,
      paddingHorizontal: 20,
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.isDark ? 0.26 : 0.09,
      shadowRadius: 18,
      elevation: 4,
    },
    iconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.isDark ? 'rgba(86,194,138,0.18)' : 'rgba(47,122,82,0.13)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    logoImage: {
      width: 82,
      height: 82,
      borderRadius: 24,
    },
    title: {
      fontSize: 34,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 10,
      fontFamily: 'serif',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 23,
    },
    currentPlanBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.isDark ? theme.colors.card : theme.colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    currentPlanText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    plansSection: {
      marginBottom: 24,
    },
    statusCard: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 24,
      paddingHorizontal: 18,
      borderRadius: 18,
      backgroundColor: theme.isDark ? theme.colors.card : theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statusTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    statusText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryButton: {
      marginTop: 4,
    },
    stickyFooter: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    restoreButton: {
      marginBottom: 4,
    },
    footer: {
      marginTop: 24,
      paddingTop: 18,
    },
    footerText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    footerLink: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
  });

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { subscriptionService } from '../services/subscriptionService';
import { SubscriptionProduct } from '../types';

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { purchaseSubscription, restorePurchases, subscription } = useSubscription();
  const styles = createStyles(theme);

  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isPurchasing, setPurchasing] = useState(false);
  const [isRestoring, setRestoring] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const availableProducts = await subscriptionService.getAvailableProducts();
    setProducts(availableProducts);
    // Pre-select annual plan (better value)
    if (availableProducts.length > 0) {
      setSelectedProductId(availableProducts[1]?.id || availableProducts[0].id);
    }
  };

  const handlePurchase = async () => {
    if (!selectedProductId) {
      Alert.alert('Error', 'Please select a plan');
      return;
    }

    const selectedProduct = products.find(p => p.id === selectedProductId);
    setPurchasing(true);

    try {
      const result = await purchaseSubscription(selectedProductId, selectedProduct?.rcPackage);

      if (result.success) {
        Alert.alert(
          'Success!',
          'Your subscription is now active. Enjoy unlimited generations!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Purchase Failed', result.error || 'Something went wrong');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process purchase');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <AppIcon name="X" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <AppIcon name="StarFour" size={40} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Unlock Unlimited Plant Designs</Text>
          <Text style={styles.subtitle}>
            Create as many AI-generated designs as you want
          </Text>
        </View>

        {subscription?.isActive && (
          <View style={styles.currentPlanBadge}>
            <AppIcon name="CheckCircle" size={20} color={theme.colors.primary} />
            <Text style={styles.currentPlanText}>
              Current Plan: {subscription.type === 'annual' ? 'Annual' : 'Monthly'}
            </Text>
          </View>
        )}

        <View style={styles.plansSection}>
          {products.map((product) => (
            <PlanCard
              key={product.id}
              product={product}
              isSelected={selectedProductId === product.id}
              onSelect={() => setSelectedProductId(product.id)}
              theme={theme}
              isCurrentPlan={!!(subscription?.isActive && ((subscription.type === 'monthly' && product.period === 'month') || (subscription.type === 'annual' && product.period === 'year')))}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.purchaseButton, isPurchasing && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={isPurchasing || !selectedProductId}
          activeOpacity={0.8}
        >
          {isPurchasing ? (
            <ActivityIndicator color={theme.colors.surface} />
          ) : (
            <>
              <AppIcon name="CreditCard" size={20} color={theme.colors.surface} />
              <Text style={styles.purchaseButtonText}>
                Subscribe Now
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchases}
          disabled={isRestoring}
          activeOpacity={0.6}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          ) : (
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By subscribing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
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
  const isAnnual = product.period === 'year';

  return (
    <TouchableOpacity
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          padding: 20,
          borderWidth: 2,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          marginBottom: 12,
        },
        isCurrentPlan && { opacity: 0.7 },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
      disabled={isCurrentPlan}
    >
      {isAnnual && (
        <View
          style={{
            position: 'absolute',
            top: -10,
            right: 20,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: theme.colors.surface,
            }}
          >
            BEST VALUE
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: theme.colors.text,
              marginBottom: 4,
            }}
          >
            {product.name}
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: 'bold',
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
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    iconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.isDark ? theme.colors.surface : '#f0fdf4',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    currentPlanBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.isDark ? theme.colors.surface : '#f0fdf4',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 24,
    },
    currentPlanText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    plansSection: {
      marginBottom: 24,
    },
    purchaseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    purchaseButtonDisabled: {
      opacity: 0.6,
    },
    purchaseButtonText: {
      fontSize: 17,
      fontWeight: 'bold',
      color: theme.colors.surface,
    },
    restoreButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    restoreButtonText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    footer: {
      marginTop: 24,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    footerText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });

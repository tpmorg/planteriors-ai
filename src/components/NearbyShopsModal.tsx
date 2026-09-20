import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon } from './AppIcon';
import { AppButton } from './AppButton';
import { useTheme } from '../contexts/ThemeContext';
import { placesService, NearbyShop } from '../services/placesService';
import { useToast } from '../contexts/ToastContext';
import * as WebBrowser from 'expo-web-browser';

interface NearbyShopsModalProps {
  visible: boolean;
  plantName: string;
  onDismiss: () => void;
}

function formatDistance(meters?: number): string {
  if (meters === undefined || meters === null) return '';
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function ShopRow({
  shop,
  theme,
  onPress,
}: {
  shop: NearbyShop;
  theme: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.shopRow,
        { borderBottomColor: theme.colors.border },
        pressed && styles.shopRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={shop.name}
      accessibilityHint={`${shop.address}. Opens directions in maps.`}
    >
      <View style={styles.shopIconContainer}>
        <AppIcon name="Storefront" size={22} color={theme.colors.primary} />
      </View>
      <View style={styles.shopContent}>
        <Text style={[styles.shopName, { color: theme.colors.text }]} numberOfLines={1}>
          {shop.name}
        </Text>
        <Text style={[styles.shopAddress, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {shop.address}
        </Text>
        <View style={styles.shopMetaRow}>
          {shop.rating !== undefined && shop.rating > 0 && (
            <View style={styles.ratingPill}>
              <AppIcon name="Star" size={12} color="#f59e0b" weight="fill" />
              <Text style={styles.ratingText}>{shop.rating.toFixed(1)}</Text>
            </View>
          )}
          {shop.openNow !== undefined && (
            <View
              style={[
                styles.statusPill,
                { backgroundColor: shop.openNow ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: shop.openNow ? '#22c55e' : '#ef4444' },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: shop.openNow ? '#15803d' : '#b91c1c' },
                ]}
              >
                {shop.openNow ? 'Open' : 'Closed'}
              </Text>
            </View>
          )}
          {shop.distanceMeters !== undefined && (
            <Text style={[styles.distanceText, { color: theme.colors.textSecondary }]}>
              {formatDistance(shop.distanceMeters)}
            </Text>
          )}
        </View>
      </View>
      <AppIcon name="CaretRight" size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

export const NearbyShopsModal: React.FC<NearbyShopsModalProps> = ({
  visible,
  plantName,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [shops, setShops] = useState<NearbyShop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usedLocation, setUsedLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      loadShops();
      progress.value = withTiming(1, { duration: 250 });
    } else {
      progress.value = 0;
      setShops([]);
      setError(null);
    }
  }, [visible]);

  const loadShops = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await placesService.searchNearbyPlantShops(plantName);
      setShops(result.shops);
      setUsedLocation(result.usedLocation);
      if (result.shops.length === 0) {
        setError('No plant shops found nearby. Try a broader search.');
      }
    } catch (err) {
      console.error('Failed to load nearby shops:', err);
      setError('Could not find nearby shops. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openShop = async (shop: NearbyShop) => {
    if (shop.googleMapsUri) {
      try {
        await WebBrowser.openBrowserAsync(shop.googleMapsUri);
      } catch {
        // Fallback to linking
        await Linking.openURL(shop.googleMapsUri);
      }
    } else if (shop.latitude && shop.longitude) {
      const url = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(shop.name)}@${shop.latitude},${shop.longitude}`,
        android: `geo:${shop.latitude},${shop.longitude}?q=${encodeURIComponent(shop.name)}`,
      });
      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          showToast('Could not open maps', 'error');
        }
      }
    }
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 400 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            panelStyle,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                  Find Nearby
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                  Plant shops for {plantName}
                </Text>
              </View>
              <AppButton
                variant="icon"
                size="md"
                icon="X"
                onPress={onDismiss}
                accessibilityLabel="Close nearby shops"
              />
            </View>

            {!usedLocation && !isLoading && (
              <View style={[styles.locationBanner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <AppIcon name="MapPin" size={16} color={theme.colors.primary} />
                <Text style={[styles.locationBannerText, { color: theme.colors.textSecondary }]}>
                  Enable location for better results near you
                </Text>
              </View>
            )}

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                  Searching nearby plant shops...
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <AppIcon name="Storefront" size={48} color={theme.colors.border} />
                <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
                  {error}
                </Text>
                <AppButton
                  variant="primary"
                  size="md"
                  icon="ArrowClockwise"
                  title="Try Again"
                  onPress={loadShops}
                  style={styles.retryButton}
                />
              </View>
            ) : (
              <FlatList
                data={shops}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <ShopRow shop={item} theme={theme} onPress={() => openShop(item)} />
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <AppIcon name="Storefront" size={48} color={theme.colors.border} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                      No shops found nearby
                    </Text>
                  </View>
                }
              />
            )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  retryButton: {
    marginTop: 8,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  shopRowPressed: {
    opacity: 0.7,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 14,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  shopIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(143,179,154,0.12)',
  },
  shopContent: {
    flex: 1,
    gap: 4,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
  },
  shopAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

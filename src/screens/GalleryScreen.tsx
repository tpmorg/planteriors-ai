import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { SavedDesign } from '../types';
import { databaseService } from '../services/databaseService';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { UsageIndicator } from '../components/UsageIndicator';

interface GalleryScreenProps {
  onNewDesign: () => void;
  onDesignSelect: (design: SavedDesign, designs: SavedDesign[], initialIndex: number) => void;
  onUpgradePress?: () => void;
}

const { width } = Dimensions.get('window');
const numColumns = 2;
const itemSize = (width - 60) / numColumns; // Account for padding and gap

export const GalleryScreen: React.FC<GalleryScreenProps> = ({
  onNewDesign,
  onDesignSelect,
  onUpgradePress,
}) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme } = useTheme();
  const { subscription, freeGenerationsRemaining, refreshStatus } = useSubscription();

  const loadDesigns = useCallback(async () => {
    try {
      const savedDesigns = await databaseService.getAllDesigns();
      setDesigns(savedDesigns);
    } catch (error) {
      console.error('Failed to load designs:', error);
      Alert.alert('Error', 'Failed to load your designs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDesigns(), refreshStatus()]);
    setRefreshing(false);
  }, [loadDesigns, refreshStatus]);

  useEffect(() => {
    loadDesigns();
  }, [loadDesigns]);

  const handleDesignPress = (design: SavedDesign, index: number) => {
    onDesignSelect(design, designs, index);
  };

  const toggleFavorite = async (design: SavedDesign) => {
    try {
      await databaseService.toggleFavorite(design.id);
      // Update local state
      setDesigns(prev =>
        prev.map(d =>
          d.id === design.id
            ? { ...d, isFavorite: !d.isFavorite }
            : d
        )
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getImageUri = (design: SavedDesign) => {
    // Use local path if available, otherwise use generated image URI
    return design.localImagePath || design.generatedImageUri;
  };

  const renderDesignItem = ({ item, index }: { item: SavedDesign; index: number }) => (
    <TouchableOpacity
      style={styles.designItem}
      onPress={() => handleDesignPress(item, index)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: getImageUri(item) }}
          style={styles.designImage}
          resizeMode="cover"
        />

        {/* Favorite button */}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item)}
        >
          <AppIcon
            name="Heart"
            size={18}
            color={item.isFavorite ? '#dc2626' : 'white'}
            weight={item.isFavorite ? 'fill' : 'regular'}
          />
        </TouchableOpacity>

        {/* Plant info overlay */}
        <View style={styles.infoOverlay}>
          <Text style={styles.plantTypeText} numberOfLines={1}>
            {item.mode === 'individual' && item.individualPlant
              ? item.individualPlant.name
              : item.plantType?.name || 'Custom'}
          </Text>
          <Text style={styles.plantStyleText} numberOfLines={1}>
            {item.mode === 'individual' && item.individualPlant
              ? `${item.individualPlant.size} • ${item.individualPlant.placement}`
              : item.plantStyle?.name || 'Design'}
          </Text>
        </View>
      </View>

      {/* Date */}
      <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  const styles = createStyles(theme);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconRing}>
        <AppIcon name="Leaf" size={40} color={theme.colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No designs yet</Text>
      <Text style={styles.emptyText}>
        Snap a photo of your room and let AI add the perfect plants
      </Text>
      <TouchableOpacity style={styles.emptyCreateButton} onPress={onNewDesign}>
        <AppIcon name="Plus" size={18} color="white" />
        <Text style={styles.emptyCreateText}>Create Your First Design</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.backdropBlobA} />
        <View style={styles.backdropBlobB} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gallery</Text>
          <TouchableOpacity onPress={onNewDesign} style={styles.newDesignButton}>
            <AppIcon name="Plus" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your images...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Spaces</Text>
        <TouchableOpacity onPress={onNewDesign} style={styles.newDesignButton}>
          <AppIcon name="Plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Usage Indicator */}
      <UsageIndicator
        freeRemaining={freeGenerationsRemaining}
        isSubscribed={subscription?.isActive || false}
        variant="full"
        onUpgradePress={onUpgradePress}
      />

      <FlatList
        data={designs}
        renderItem={renderDesignItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={[styles.listContainer, { paddingBottom: tabBarHeight + 20 }]}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backdropBlobA: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: theme.isDark ? 'rgba(143,179,154,0.12)' : 'rgba(78,107,87,0.11)',
    top: -90,
    left: -60,
  },
  backdropBlobB: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.isDark ? 'rgba(181,122,82,0.08)' : 'rgba(181,122,82,0.08)',
    bottom: -120,
    right: -80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
    letterSpacing: 0.2,
    fontFamily: 'serif',
  },
  newDesignButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
  },
  designItem: {
    width: itemSize,
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.32 : 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  designImage: {
    width: '100%',
    height: itemSize,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 17,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  plantTypeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  plantStyleText: {
    color: 'white',
    fontSize: 11,
    opacity: 0.9,
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.isDark ? theme.colors.surface : '#f0fdf4',
    borderWidth: 2,
    borderColor: theme.isDark ? theme.colors.border : '#bbf7d0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 24,
    marginBottom: 10,
    fontFamily: 'serif',
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 270,
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyCreateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

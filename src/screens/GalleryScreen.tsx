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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Designs</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    flex: 1,
  },
  newDesignButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: 20,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
  },
  designItem: {
    width: itemSize,
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.borderLight,
  },
  designImage: {
    width: '100%',
    height: itemSize,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
  },
  plantTypeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  plantStyleText: {
    color: 'white',
    fontSize: 10,
    opacity: 0.9,
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 4,
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
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
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

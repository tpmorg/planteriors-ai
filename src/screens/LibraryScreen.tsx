import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppIcon } from '../components/AppIcon';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { getPlantById as getSeedPlantById } from '../data/plantDatabase';
import { databaseService } from '../services/databaseService';
import { PlantSearchResult } from '../types';

interface LibraryScreenProps {
  onPlantSelect: (plant: PlantSearchResult) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ onPlantSelect }) => {
  const [plants, setPlants] = useState<PlantSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plantCount, setPlantCount] = useState(0);
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();

  const isTablet = Platform.OS === 'ios' && Math.min(width, height) >= 768;
  const numColumns = isTablet ? (width >= 1180 ? 5 : 4) : 2;
  const listHorizontalPadding = isTablet ? 24 : 16;
  const interItemGap = isTablet ? 14 : 12;
  const itemSize = Math.floor(
    (width - listHorizontalPadding * 2 - interItemGap * (numColumns - 1)) / numColumns
  );

  const loadPlants = useCallback(async () => {
    try {
      setIsLoading(true);
      const count = await databaseService.getPlantsCount();
      const results = await databaseService.searchPlants(searchQuery, { limit: 500 });
      setPlantCount(count);
      setPlants(results);
    } catch (error) {
      console.error('Failed to load plants:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlants();
    setRefreshing(false);
  }, [loadPlants]);

  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

  useFocusEffect(
    useCallback(() => {
      loadPlants();
    }, [loadPlants])
  );

  const renderPlantCard = ({ item }: { item: PlantSearchResult }) => {
    const imageSource = getPlantImageSource(item);

    return (
      <TouchableOpacity
        style={[styles.plantCard, { width: itemSize }]}
        onPress={() => onPlantSelect(item)}
        activeOpacity={0.85}
        accessibilityLabel={`Open ${item.name}`}
      >
        <View
          style={[
            styles.plantImageFrame,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {imageSource ? (
            <Image source={imageSource} style={styles.plantImage} resizeMode="cover" />
          ) : (
            <AppIcon
              name={item.icon || 'Leaf'}
              size={42}
              color={theme.colors.primary}
              weight="fill"
            />
          )}
          {item.userAdded && (
            <View style={styles.userAddedBadge}>
              <Text style={styles.userAddedBadgeText}>Imported</Text>
            </View>
          )}
        </View>

        <Text style={[styles.plantName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text
          style={[styles.scientificName, { color: theme.colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.scientificName}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <AppIcon name="Plant" size={64} color={theme.colors.border} weight="thin" />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        {plantCount === 0 ? 'Plant Library is Empty' : 'No Plants Found'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        {plantCount === 0
          ? 'Plants will appear here once the library is populated.'
          : 'Try a different plant name.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Plant Library</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          {plantCount > 0 ? `${plantCount} plants` : 'Browse & search plants'}
        </Text>
      </View>

      <View style={[styles.searchContainer, { paddingHorizontal: listHorizontalPadding }]}>
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <AppIcon name="MagnifyingGlass" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search plants..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear plant search">
              <AppIcon name="XCircle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          key={`library-${numColumns}`}
          data={plants}
          renderItem={renderPlantCard}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: listHorizontalPadding,
              paddingBottom: tabBarHeight + 16,
            },
          ]}
          columnWrapperStyle={{ gap: interItemGap }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
};

function getPlantImageSource(plant: PlantSearchResult): ImageSourcePropType | undefined {
  if (plant.localImagePath || plant.primaryImageUrl) {
    return { uri: plant.localImagePath || plant.primaryImageUrl };
  }

  const seedPlant = getSeedPlantById(plant.id);
  return seedPlant?.imageUrl;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 2,
  },
  searchContainer: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 44,
    paddingVertical: 0,
  },
  listContent: {
    paddingTop: 4,
    rowGap: 20,
  },
  plantCard: {
    minWidth: 0,
  },
  plantImageFrame: {
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantImage: {
    width: '100%',
    height: '100%',
  },
  userAddedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(47,122,82,0.92)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAddedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  plantName: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  scientificName: {
    marginTop: 2,
    fontSize: 12,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});

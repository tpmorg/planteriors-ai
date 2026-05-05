import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
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
import { CareLevel, LightRequirement, PlacementType, PlantSearchResult, WaterRequirement } from '../types';

interface LibraryScreenProps {
  onPlantSelect: (plant: PlantSearchResult) => void;
}

type FilterKey = 'light' | 'careLevel' | 'waterRequirement' | 'placement';

interface LibraryFilters {
  light?: 'low-tolerant' | LightRequirement;
  careLevel?: CareLevel;
  waterRequirement?: WaterRequirement;
  placement?: Exclude<PlacementType, 'auto'>;
  petSafe?: boolean;
}

interface FilterOption {
  label: string;
  value: string;
}

const FILTER_GROUPS: Array<{ key: FilterKey; title: string; options: FilterOption[] }> = [
  {
    key: 'light',
    title: 'Light',
    options: [
      { label: 'Low tolerant', value: 'low-tolerant' },
      { label: 'Bright indirect', value: 'bright-indirect' },
      { label: 'Direct sun', value: 'bright-direct' },
    ],
  },
  {
    key: 'careLevel',
    title: 'Care',
    options: [
      { label: 'Easy', value: 'easy' },
      { label: 'Moderate', value: 'moderate' },
      { label: 'Advanced', value: 'difficult' },
    ],
  },
  {
    key: 'waterRequirement',
    title: 'Water',
    options: [
      { label: 'Low water', value: 'low' },
      { label: 'Moderate', value: 'moderate' },
      { label: 'High moisture', value: 'high' },
    ],
  },
  {
    key: 'placement',
    title: 'Placement',
    options: [
      { label: 'Floor', value: 'floor' },
      { label: 'Shelf', value: 'shelf' },
      { label: 'Hanging', value: 'hanging' },
    ],
  },
];

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ onPlantSelect }) => {
  const [plants, setPlants] = useState<PlantSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>({});
  const [showFilters, setShowFilters] = useState(false);
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
  const activeFilterChips = useMemo(() => getActiveFilterChips(filters), [filters]);
  const activeFilterCount = activeFilterChips.length;

  const loadPlants = useCallback(async () => {
    try {
      setIsLoading(true);
      const count = await databaseService.getPlantsCount();
      const results = await databaseService.searchPlants(searchQuery, {
        ...toSearchFilterOptions(filters),
        limit: 500,
      });
      setPlantCount(count);
      setPlants(results);
    } catch (error) {
      console.error('Failed to load plants:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, searchQuery]);

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

  const setFilter = useCallback((key: FilterKey, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: current[key] === value ? undefined : value,
    }));
  }, []);

  const togglePetSafe = useCallback(() => {
    setFilters((current) => ({
      ...current,
      petSafe: current.petSafe ? undefined : true,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const removeFilter = useCallback((key: keyof LibraryFilters) => {
    setFilters((current) => ({
      ...current,
      [key]: undefined,
    }));
  }, []);

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

        <View style={styles.filterSummaryRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: showFilters ? theme.colors.primary : theme.colors.surface,
                borderColor: showFilters ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => setShowFilters((visible) => !visible)}
            accessibilityLabel="Show library filters"
            activeOpacity={0.85}
          >
            <AppIcon
              name="SlidersHorizontal"
              size={17}
              color={showFilters ? '#ffffff' : theme.colors.text}
              weight="bold"
            />
            <Text style={[styles.filterButtonText, { color: showFilters ? '#ffffff' : theme.colors.text }]}>
              Filters{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
            </Text>
          </TouchableOpacity>

          {activeFilterCount > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeChipsContent}
              style={styles.activeChipsScroll}
            >
              {activeFilterChips.map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.activeChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => removeFilter(chip.key)}
                  accessibilityLabel={`Remove ${chip.label} filter`}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.activeChipText, { color: theme.colors.text }]} numberOfLines={1}>
                    {chip.label}
                  </Text>
                  <AppIcon name="X" size={12} color={theme.colors.textSecondary} weight="bold" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {showFilters && (
          <View style={[styles.filterPanel, { borderColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[
                styles.petSafePill,
                {
                  backgroundColor: filters.petSafe ? theme.colors.primary : theme.colors.surface,
                  borderColor: filters.petSafe ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={togglePetSafe}
              activeOpacity={0.85}
              accessibilityLabel="Filter pet safe plants"
            >
              <AppIcon
                name="ShieldCheck"
                size={16}
                color={filters.petSafe ? '#ffffff' : theme.colors.text}
                weight="bold"
              />
              <Text style={[styles.petSafePillText, { color: filters.petSafe ? '#ffffff' : theme.colors.text }]}>
                Pet safe
              </Text>
            </TouchableOpacity>

            {FILTER_GROUPS.map((group) => (
              <View key={group.key} style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: theme.colors.textSecondary }]}>{group.title}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterOptionsContent}
                >
                  {group.options.map((option) => {
                    const isSelected = filters[group.key] === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.filterOption,
                          {
                            backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                        onPress={() => setFilter(group.key, option.value)}
                        activeOpacity={0.85}
                        accessibilityLabel={`Filter ${group.title} by ${option.label}`}
                      >
                        <Text
                          style={[
                            styles.filterOptionText,
                            { color: isSelected ? '#ffffff' : theme.colors.text },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ))}

            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersButton} accessibilityLabel="Clear filters">
                <Text style={[styles.clearFiltersText, { color: theme.colors.primary }]}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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

function toSearchFilterOptions(filters: LibraryFilters) {
  const options: {
    careLevel?: CareLevel;
    lightRequirements?: string[];
    waterRequirement?: WaterRequirement;
    petSafe?: boolean;
    placement?: Exclude<PlacementType, 'auto'>;
  } = {};

  if (filters.careLevel) {
    options.careLevel = filters.careLevel;
  }
  if (filters.light === 'low-tolerant') {
    options.lightRequirements = ['low', 'low-to-bright'];
  } else if (filters.light) {
    options.lightRequirements = [filters.light];
  }
  if (filters.waterRequirement) {
    options.waterRequirement = filters.waterRequirement;
  }
  if (filters.petSafe) {
    options.petSafe = true;
  }
  if (filters.placement) {
    options.placement = filters.placement;
  }

  return options;
}

function getActiveFilterChips(filters: LibraryFilters) {
  const chips: Array<{ key: keyof LibraryFilters; label: string }> = [];

  const addChip = (key: keyof LibraryFilters, label: string) => {
    chips.push({
      key,
      label,
    });
  };

  if (filters.light) {
    addChip('light', getOptionLabel('light', filters.light));
  }
  if (filters.petSafe) {
    addChip('petSafe', 'Pet safe');
  }
  if (filters.careLevel) {
    addChip('careLevel', getOptionLabel('careLevel', filters.careLevel));
  }
  if (filters.waterRequirement) {
    addChip('waterRequirement', getOptionLabel('waterRequirement', filters.waterRequirement));
  }
  if (filters.placement) {
    addChip('placement', getOptionLabel('placement', filters.placement));
  }

  return chips;
}

function getOptionLabel(key: FilterKey, value: string) {
  const group = FILTER_GROUPS.find((item) => item.key === key);
  return group?.options.find((option) => option.value === value)?.label || value;
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
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    minHeight: 34,
  },
  filterButton: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeChipsScroll: {
    flex: 1,
  },
  activeChipsContent: {
    gap: 8,
    paddingRight: 2,
  },
  activeChip: {
    height: 30,
    maxWidth: 150,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  filterPanel: {
    marginTop: 10,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  petSafePill: {
    alignSelf: 'flex-start',
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  petSafePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterGroup: {
    marginTop: 8,
  },
  filterGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  filterOptionsContent: {
    gap: 8,
    paddingRight: 4,
  },
  filterOption: {
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    paddingTop: 12,
    paddingBottom: 2,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '800',
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

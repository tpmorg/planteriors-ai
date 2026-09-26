import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageSourcePropType,
} from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { AppButton } from '../components/AppButton';
import { PlantCatalogCard } from '../components/PlantCatalogCard';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
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

function getPlantImageSource(plant: PlantSearchResult): ImageSourcePropType | undefined {
  if (plant.localImagePath || plant.primaryImageUrl) {
    return { uri: plant.localImagePath || plant.primaryImageUrl };
  }

  const seedPlant = getSeedPlantById(plant.id);
  return seedPlant?.imageUrl;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ onPlantSelect }) => {
  const [plants, setPlants] = useState<PlantSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isVoiceSearchStarting, setIsVoiceSearchStarting] = useState(false);
  const [isVoiceSearchListening, setIsVoiceSearchListening] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plantCount, setPlantCount] = useState(0);
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const listHorizontalPadding = 16;
  const activeFilterChips = useMemo(() => getActiveFilterChips(filters), [filters]);
  const activeFilterCount = activeFilterChips.length;
  const importedCount = useMemo(
    () => plants.filter((plant) => plant.userAdded).length,
    [plants]
  );
  const voiceSearchContext = useMemo(
    () => Array.from(new Set(plants.map((plant) => plant.name))).slice(0, 24),
    [plants]
  );
  const isVoiceSearchBusy = isVoiceSearchStarting || isVoiceSearchListening;

  useSpeechRecognitionEvent('start', () => {
    setIsVoiceSearchStarting(false);
    setIsVoiceSearchListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsVoiceSearchStarting(false);
    setIsVoiceSearchListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (transcript) {
      setSearchQuery(transcript);
    }
  });

  useSpeechRecognitionEvent('nomatch', () => {
    setIsVoiceSearchStarting(false);
    setIsVoiceSearchListening(false);
    showToast('No plant name came through. Try again.', 'info');
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsVoiceSearchStarting(false);
    setIsVoiceSearchListening(false);

    if (event.error === 'aborted') {
      return;
    }

    if (event.error === 'no-speech' || event.error === 'speech-timeout') {
      showToast('No speech detected. Try again.', 'info');
      return;
    }

    if (event.error === 'not-allowed') {
      showToast('Microphone permission is required for voice search.', 'error');
      return;
    }

    if (event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
      showToast('Voice search is unavailable on this device right now.', 'error');
      return;
    }

    showToast(event.message || 'Voice search failed to start.', 'error');
  });

  const isVoiceSearchAvailable = useCallback(() => {
    try {
      return ExpoSpeechRecognitionModule?.isRecognitionAvailable?.() ?? false;
    } catch (error) {
      console.warn('Speech recognition availability check failed:', error);
      return false;
    }
  }, []);

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

  const renderPlantCard = useCallback(
    ({ item }: { item: PlantSearchResult }) => (
      <View style={styles.rowItem}>
        <PlantCatalogCard
          plant={item}
          imageSource={getPlantImageSource(item)}
          onPress={() => onPlantSelect(item)}
          variant="hero"
        />
      </View>
    ),
    [onPlantSelect]
  );

  const renderEmptyState = useCallback(() => (
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
  ), [plantCount, theme]);

  const listContentStyle = useMemo(() => [
    styles.listContent,
    {
      paddingHorizontal: listHorizontalPadding,
      paddingBottom: tabBarHeight + 16,
    },
  ], [listHorizontalPadding, tabBarHeight]);

  const keyExtractor = useCallback((item: PlantSearchResult) => item.id, []);

  const handleVoiceSearchPress = useCallback(async () => {
    const speechRecognitionModule = ExpoSpeechRecognitionModule;

    if (isVoiceSearchBusy) {
      speechRecognitionModule?.stop?.();
      return;
    }

    if (!speechRecognitionModule || !isVoiceSearchAvailable()) {
      showToast('Voice search is unavailable on this device right now.', 'error');
      return;
    }

    setIsVoiceSearchStarting(true);

    try {
      const permission = await speechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setIsVoiceSearchStarting(false);
        showToast(
          permission.canAskAgain
            ? 'Allow microphone access to search by voice.'
            : 'Microphone access for voice search is disabled in Settings.',
          'error'
        );
        return;
      }

      speechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: false,
        iosTaskHint: 'search',
        contextualStrings: voiceSearchContext,
      });
    } catch (error) {
      console.error('Failed to start voice search:', error);
      setIsVoiceSearchStarting(false);
      showToast('Voice search failed to start.', 'error');
    }
  }, [isVoiceSearchAvailable, isVoiceSearchBusy, showToast, voiceSearchContext]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} testID="screen-library">Library</Text>
      </View>

      <View style={[styles.searchContainer, { paddingHorizontal: listHorizontalPadding }]}>
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow,
                shadowOpacity: theme.isDark ? 0.18 : 0.08,
              },
            ]}
          >
            <AppIcon name="MagnifyingGlass" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search plants"
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            <AppButton
              variant="icon"
              size="sm"
              icon="Microphone"
              iconWeight={isVoiceSearchBusy ? 'fill' : 'regular'}
              iconColor={isVoiceSearchBusy ? theme.colors.onPrimary : theme.colors.textSecondary}
              loading={isVoiceSearchStarting}
              onPress={handleVoiceSearchPress}
              accessibilityLabel={isVoiceSearchBusy ? 'Stop voice search' : 'Start voice search'}
              style={
                isVoiceSearchBusy
                  ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                  : undefined
              }
            />
            {searchQuery.length > 0 && (
              <AppButton
                variant="icon"
                size="sm"
                icon="XCircle"
                onPress={() => setSearchQuery('')}
                accessibilityLabel="Clear plant search"
              />
            )}
          </View>

          <AppButton
            variant="icon"
            size="md"
            icon="SlidersHorizontal"
            iconWeight="bold"
            iconColor={showFilters ? theme.colors.onPrimary : theme.colors.text}
            badge={activeFilterCount > 0 ? activeFilterCount : null}
            onPress={() => setShowFilters((visible) => !visible)}
            accessibilityLabel={
              activeFilterCount > 0
                ? `${showFilters ? 'Hide' : 'Show'} library filters, ${activeFilterCount} active`
                : `${showFilters ? 'Hide' : 'Show'} library filters`
            }
            style={[
              styles.filterButton,
              { shadowColor: theme.colors.shadow, shadowOpacity: theme.isDark ? 0.18 : 0.08 },
              showFilters
                ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          />
        </View>

        {activeFilterCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipsContent}
            style={styles.activeChipsScroll}
          >
            {activeFilterChips.map((chip) => (
              <AppButton
                key={chip.key}
                variant="chip"
                size="sm"
                title={chip.label}
                icon="X"
                iconPosition="right"
                textStyle={styles.activeChipText}
                onPress={() => removeFilter(chip.key)}
                accessibilityLabel={`Remove ${chip.label} filter`}
                style={styles.activeChip}
              />
            ))}
          </ScrollView>
        )}

        {showFilters && (
          <View
            style={[
              styles.filterPanel,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <AppButton
              variant="chip"
              size="sm"
              icon="ShieldCheck"
              iconWeight="bold"
              title="Pet safe"
              selected={!!filters.petSafe}
              onPress={togglePetSafe}
              accessibilityLabel="Filter pet safe plants"
              style={styles.petSafePill}
            />

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
                      <AppButton
                        key={option.value}
                        variant="chip"
                        size="sm"
                        title={option.label}
                        selected={isSelected}
                        onPress={() => setFilter(group.key, option.value)}
                        accessibilityLabel={`Filter ${group.title} by ${option.label}`}
                        style={styles.filterOption}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            ))}

            {activeFilterCount > 0 && (
              <AppButton
                variant="ghost"
                size="sm"
                title="Clear filters"
                onPress={clearFilters}
                accessibilityLabel="Clear filters"
                style={styles.clearFiltersButton}
              />
            )}
          </View>
        )}

        <View style={styles.resultsSummaryRow}>
          <Text style={[styles.resultsSummaryText, { color: theme.colors.textSecondary }]}>
            {searchQuery.trim().length > 0 || activeFilterCount > 0
              ? `${plants.length} matching ${plants.length === 1 ? 'plant' : 'plants'}`
              : `${plantCount} plants to browse`}
          </Text>

          {importedCount > 0 && (
            <View
              style={[
                styles.resultsBadge,
                {
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : '#f6f7f4',
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.resultsBadgeText, { color: theme.colors.text }]}>
                {importedCount} imported
              </Text>
            </View>
          )}
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={plants}
          renderItem={renderPlantCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={listContentStyle}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
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
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 2,
  },
  searchContainer: {
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 48,
    paddingVertical: 0,
  },
  filterButton: {
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  activeChipsScroll: {
    marginTop: -2,
  },
  activeChipsContent: {
    gap: 8,
    paddingRight: 2,
  },
  activeChip: {
    maxWidth: 150,
  },
  activeChipText: {
    fontSize: 12,
  },
  filterPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  resultsSummaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultsSummaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  resultsBadge: {
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  petSafePill: {
    alignSelf: 'flex-start',
    marginBottom: 10,
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
  filterOption: {},
  clearFiltersButton: {
    alignSelf: 'flex-start',
    paddingTop: 12,
    paddingBottom: 2,
  },
  listContent: {
    paddingTop: 4,
  },
  rowItem: {
    width: '100%',
  },
  listSeparator: {
    height: 10,
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

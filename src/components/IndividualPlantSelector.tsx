import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ListRenderItem,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { AppIcon } from './AppIcon';
import {
  IndividualPlant,
  PlantSize,
  PlacementType,
  IndividualPlantSelection,
} from '../types';
import { INDIVIDUAL_PLANTS, PLANT_SIZE_OPTIONS } from '../data/plantDatabase';
import { useTheme } from '../contexts/ThemeContext';

interface IndividualPlantSelectorProps {
  onSelectionChange: (selection: IndividualPlantSelection | null) => void;
  selection: IndividualPlantSelection | null;
  onSearchActiveChange?: (isActive: boolean) => void;
  listHeader?: React.ReactNode;
  listFooterSpacerHeight?: number;
}

export const IndividualPlantSelector: React.FC<IndividualPlantSelectorProps> = ({
  onSelectionChange,
  selection,
  onSearchActiveChange,
  listHeader,
  listFooterSpacerHeight = 0,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<IndividualPlant | null>(
    selection?.plant || null
  );
  const [selectedSize, setSelectedSize] = useState<PlantSize | null>(
    selection?.size || null
  );
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementType | null>(
    selection?.placement || 'auto'
  );

  // Filter plants based on search
  const [filteredPlants, setFilteredPlants] = useState<IndividualPlant[]>(INDIVIDUAL_PLANTS);
  const [isListLoading, setIsListLoading] = useState(true);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
  const listRef = useRef<FlatList<IndividualPlant>>(null);
  const scrollOffsetRef = useRef(0);
  const searchContainerTopRef = useRef(0);

  const { theme } = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    setIsListLoading(true);
    const lowerQuery = searchQuery.toLowerCase().trim();
    const filtered = !lowerQuery
      ? INDIVIDUAL_PLANTS
      : INDIVIDUAL_PLANTS.filter(
          (plant) =>
            plant.name.toLowerCase().includes(lowerQuery) ||
            plant.scientificName.toLowerCase().includes(lowerQuery) ||
            plant.description.toLowerCase().includes(lowerQuery) ||
            plant.category.toLowerCase().includes(lowerQuery)
        );
    setFilteredPlants(filtered);
    const timeout = setTimeout(() => setIsListLoading(false), 50);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (!onSearchActiveChange) {
      return;
    }

    const isActive =
      !selectedPlant && (isSearchFocused || searchQuery.trim().length > 0);
    onSearchActiveChange(isActive);

    return () => {
      onSearchActiveChange(false);
    };
  }, [selectedPlant, isSearchFocused, searchQuery, onSearchActiveChange]);

  // Update parent when selection changes
  const updateSelection = (
    plant: IndividualPlant | null,
    size: PlantSize | null,
    placement: PlacementType | null
  ) => {
    if (plant && size && placement) {
      onSelectionChange({ plant, size, placement });
    } else {
      onSelectionChange(null);
    }
  };

  const handlePlantSelect = (plant: IndividualPlant) => {
    if (selectedPlant?.id === plant.id) {
      // Deselect
      setSelectedPlant(null);
      setSelectedSize(null);
      setSelectedPlacement(null);
      updateSelection(null, null, null);
    } else {
      Keyboard.dismiss();
      setIsSearchFocused(false);
      setSelectedPlant(plant);
      // Auto-select first available size and placement
      const defaultSize = plant.availableSizes[0];
      const defaultPlacement: PlacementType = 'auto';
      setSelectedSize(defaultSize);
      setSelectedPlacement(defaultPlacement);
      updateSelection(plant, defaultSize, defaultPlacement);
    }
  };

  const handleSizeSelect = (size: PlantSize) => {
    setSelectedSize(size);
    updateSelection(selectedPlant, size, selectedPlacement);
  };

  const clearSelection = () => {
    setSelectedPlant(null);
    setSelectedSize(null);
    setSelectedPlacement('auto');
    setSearchQuery('');
    updateSelection(null, null, null);
  };

  const handleListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  };

  const handleSearchContainerLayout = (event: LayoutChangeEvent) => {
    searchContainerTopRef.current = event.nativeEvent.layout.y;
  };

  const toggleViewMode = () => {
    setShouldRestoreScroll(true);
    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
  };

  useEffect(() => {
    if (!shouldRestoreScroll || selectedPlant) {
      return;
    }

    const restoreTarget = Math.max(scrollOffsetRef.current, searchContainerTopRef.current);
    const timer = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: restoreTarget, animated: false });
      setShouldRestoreScroll(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [viewMode, shouldRestoreScroll, selectedPlant, filteredPlants.length]);

  const getCareIconName = (level: string) => {
    switch (level) {
      case 'easy':
        return 'BatteryLow';
      case 'moderate':
        return 'BatteryMedium';
      case 'difficult':
        return 'BatteryHigh';
      default:
        return 'Plant';
    }
  };

  const getLightIconName = (requirement: string) => {
    switch (requirement) {
      case 'low':
        return 'Moon';
      case 'low-to-bright':
        return 'CloudSun';
      case 'bright-indirect':
        return 'Sun';
      case 'bright-direct':
        return 'Sun';
      default:
        return 'Sun';
    }
  };

  const renderPlantItem: ListRenderItem<IndividualPlant> = ({ item: plant }) => {
    const isSelected = selectedPlant?.id === plant.id;

    return (
      <TouchableOpacity
        key={plant.id}
        style={[
          styles.plantCard,
          viewMode === 'grid' && styles.plantCardGrid,
          isSelected && styles.plantCardSelected,
        ]}
        onPress={() => handlePlantSelect(plant)}
        activeOpacity={0.7}
      >
        {plant.imageUrl ? (
          <Image
            source={plant.imageUrl}
            style={viewMode === 'grid' ? styles.plantCardImageGrid : styles.plantCardImage}
            resizeMode="cover"
          />
        ) : (
          <AppIcon
            name={plant.icon}
            size={viewMode === 'grid' ? 32 : 44}
            color={theme.colors.primary}
            style={styles.plantCardIcon}
          />
        )}
        <Text style={styles.plantCardName} numberOfLines={1} ellipsizeMode="tail">
          {plant.name}
        </Text>
        <View style={styles.plantCardBadges}>
          {plant.petSafe && (
            <AppIcon name="Heart" size={12} color={theme.colors.primary} weight="fill" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <FlatList
        ref={listRef}
        data={selectedPlant ? [] : filteredPlants}
        renderItem={renderPlantItem}
        keyExtractor={(item) => item.id}
        style={styles.plantGrid}
        contentContainerStyle={[
          styles.plantGridContent,
          viewMode === 'grid' && styles.plantGridContentCompact,
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        key={viewMode === 'grid' ? 'grid' : 'list'}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            {listHeader}
            {/* Search Bar */}
            <View style={styles.searchContainer} onLayout={handleSearchContainerLayout}>
              <View style={styles.searchInputWrapper}>
                <AppIcon
                  name="MagnifyingGlass"
                  size={18}
                  color={theme.colors.textSecondary}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search plants..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <AppIcon name="X" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.viewToggleButton}
                onPress={toggleViewMode}
                accessibilityLabel="Toggle plant list view"
                accessibilityRole="button"
              >
                <AppIcon
                  name={viewMode === 'grid' ? 'List' : 'SquaresFour'}
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Selected Plant Detail Panel */}
            {selectedPlant && (
              <View style={styles.selectedPanel}>
                <View style={styles.selectedHeader}>
                  <View style={styles.selectedPlantInfo}>
                    {selectedPlant.imageUrl ? (
                      <Image
                        source={selectedPlant.imageUrl}
                        style={styles.selectedImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <AppIcon
                        name={selectedPlant.icon}
                        size={36}
                        color={theme.colors.primary}
                        style={styles.selectedIcon}
                      />
                    )}
                    <View style={styles.selectedTextContainer}>
                      <Text style={styles.selectedName}>{selectedPlant.name}</Text>
                      <Text style={styles.selectedScientific}>
                        {selectedPlant.scientificName}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
                    <AppIcon name="X" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.selectedDescription}>{selectedPlant.description}</Text>

                {/* Care Info Badges */}
                <View style={styles.careInfo}>
                  <View style={styles.careBadge}>
                    <AppIcon
                      name={getCareIconName(selectedPlant.careLevel)}
                      size={12}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.careBadgeText}>
                      {selectedPlant.careLevel.charAt(0).toUpperCase() +
                        selectedPlant.careLevel.slice(1)}{' '}
                      care
                    </Text>
                  </View>
                  <View style={styles.careBadge}>
                    <AppIcon
                      name={getLightIconName(selectedPlant.lightRequirement)}
                      size={12}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.careBadgeText}>
                      {selectedPlant.lightRequirement.replace(/-/g, ' ')}
                    </Text>
                  </View>
                  {selectedPlant.petSafe && (
                    <View style={[styles.careBadge, styles.petSafeBadge]}>
                      <AppIcon name="Heart" size={12} color={theme.colors.primary} />
                      <Text style={[styles.careBadgeText, styles.petSafeText]}>
                        Pet safe
                      </Text>
                    </View>
                  )}
                </View>

                {/* Size Picker */}
                <Text style={styles.optionLabel}>Size</Text>
                <View style={styles.optionRow}>
                  {PLANT_SIZE_OPTIONS.filter((opt) =>
                    selectedPlant.availableSizes.includes(opt.id)
                  ).map((sizeOpt) => (
                    <TouchableOpacity
                      key={sizeOpt.id}
                      style={[
                        styles.optionCard,
                        selectedSize === sizeOpt.id && styles.optionCardSelected,
                      ]}
                      onPress={() => handleSizeSelect(sizeOpt.id)}
                    >
                      <AppIcon
                        name={sizeOpt.icon}
                        size={22}
                        color={theme.colors.primary}
                        style={styles.optionCardIcon}
                      />
                      <Text
                        style={[
                          styles.optionCardName,
                          selectedSize === sizeOpt.id && styles.optionCardNameSelected,
                        ]}
                      >
                        {sizeOpt.name}
                      </Text>
                      <Text style={styles.optionCardDesc}>{sizeOpt.heightRange}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Plant Grid Header */}
            {!selectedPlant && (
              <Text style={styles.gridLabel}>
                {searchQuery ? `${filteredPlants.length} plants found` : 'Select a plant'}
              </Text>
            )}
          </>
        }
        ListFooterComponent={
          listFooterSpacerHeight > 0 ? (
            <View style={{ height: listFooterSpacerHeight }} />
          ) : null
        }
      />
      {isListLoading && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading plants…</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: any) => {
  const selectedBg = theme.isDark ? 'rgba(134, 239, 172, 0.15)' : '#ecfdf5';

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    searchInputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
    },
    viewToggleButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
    gridLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: theme.colors.surface,
    },
    plantGrid: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    plantGridContent: {
      paddingHorizontal: 12,
      paddingBottom: 120,
    },
    plantGridContentCompact: {
      paddingHorizontal: 12,
    },
    gridRow: {
      gap: 12,
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    plantCard: {
      width: '100%',
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      marginBottom: 12,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'flex-start',
      borderWidth: 2,
      borderColor: 'transparent',
      paddingBottom: 14,
    },
    plantCardGrid: {
      flex: 1,
      marginBottom: 0,
      paddingHorizontal: 10,
    },
    plantCardSelected: {
      backgroundColor: selectedBg,
      borderColor: theme.colors.primary,
    },
    plantCardIcon: {
      fontSize: 44,
      marginBottom: 8,
      marginTop: 8,
    },
    plantCardImage: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      marginBottom: 10,
      marginTop: 4,
    },
    plantCardImageGrid: {
      width: '100%',
      height: 120,
      borderRadius: 10,
      marginBottom: 8,
      marginTop: 4,
    },
    plantCardName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 4,
      width: '100%',
    },
    plantCardBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    plantCardBadge: {
      fontSize: 10,
    },
    // Selected Panel
    selectedPanel: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    selectedHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    selectedPlantInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    selectedIcon: {
      fontSize: 36,
      marginRight: 12,
    },
    selectedImage: {
      width: 80,
      height: 80,
      borderRadius: 14,
      marginRight: 12,
    },
    selectedTextContainer: {
      flex: 1,
    },
    selectedName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    selectedScientific: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    clearButton: {
      padding: 4,
    },
    selectedDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    careInfo: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    careBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.borderLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 4,
    },
    careBadgeIcon: {
      fontSize: 12,
    },
    careBadgeText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    petSafeBadge: {
      backgroundColor: selectedBg,
    },
    petSafeText: {
      color: theme.colors.primary,
    },
    optionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 10,
      marginTop: 4,
    },
    optionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    optionCard: {
      flex: 1,
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    optionCardSelected: {
      backgroundColor: selectedBg,
      borderColor: theme.colors.primary,
    },
    optionCardIcon: {
      fontSize: 22,
      marginBottom: 4,
    },
    optionCardName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    optionCardNameSelected: {
      color: theme.colors.primary,
    },
    optionCardDesc: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.35)',
    },
    loadingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
  });
};

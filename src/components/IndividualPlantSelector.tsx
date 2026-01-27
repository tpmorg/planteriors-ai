import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Search, Check, X, Droplets, Sun, Heart } from 'lucide-react-native';
import {
  IndividualPlant,
  PlantSize,
  PlacementType,
  IndividualPlantSelection,
} from '../types';
import {
  INDIVIDUAL_PLANTS,
  PLANT_SIZE_OPTIONS,
  PLACEMENT_OPTIONS,
} from '../data/plantDatabase';

interface IndividualPlantSelectorProps {
  onSelectionChange: (selection: IndividualPlantSelection | null) => void;
  selection: IndividualPlantSelection | null;
}

export const IndividualPlantSelector: React.FC<IndividualPlantSelectorProps> = ({
  onSelectionChange,
  selection,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState<IndividualPlant | null>(
    selection?.plant || null
  );
  const [selectedSize, setSelectedSize] = useState<PlantSize | null>(
    selection?.size || null
  );
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementType | null>(
    selection?.placement || null
  );

  // Filter plants based on search
  const [filteredPlants, setFilteredPlants] = useState<IndividualPlant[]>(INDIVIDUAL_PLANTS);

  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase().trim();
    if (!lowerQuery) {
      setFilteredPlants(INDIVIDUAL_PLANTS);
    } else {
      const filtered = INDIVIDUAL_PLANTS.filter(
        (plant) =>
          plant.name.toLowerCase().includes(lowerQuery) ||
          plant.scientificName.toLowerCase().includes(lowerQuery) ||
          plant.description.toLowerCase().includes(lowerQuery) ||
          plant.category.toLowerCase().includes(lowerQuery)
      );
      setFilteredPlants(filtered);
    }
  }, [searchQuery]);

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
      setSelectedPlant(plant);
      // Auto-select first available size and placement
      const defaultSize = plant.availableSizes[0];
      const defaultPlacement = plant.suitablePlacements[0];
      setSelectedSize(defaultSize);
      setSelectedPlacement(defaultPlacement);
      updateSelection(plant, defaultSize, defaultPlacement);
    }
  };

  const handleSizeSelect = (size: PlantSize) => {
    setSelectedSize(size);
    updateSelection(selectedPlant, size, selectedPlacement);
  };

  const handlePlacementSelect = (placement: PlacementType) => {
    setSelectedPlacement(placement);
    updateSelection(selectedPlant, selectedSize, placement);
  };

  const clearSelection = () => {
    setSelectedPlant(null);
    setSelectedSize(null);
    setSelectedPlacement(null);
    setSearchQuery('');
    updateSelection(null, null, null);
  };

  const getCareIcon = (level: string) => {
    switch (level) {
      case 'easy':
        return '😌';
      case 'moderate':
        return '🙂';
      case 'difficult':
        return '🧑‍🌾';
      default:
        return '🌱';
    }
  };

  const getLightIcon = (requirement: string) => {
    switch (requirement) {
      case 'low':
        return '🌑';
      case 'low-to-bright':
        return '🌤️';
      case 'bright-indirect':
        return '☀️';
      case 'bright-direct':
        return '🔆';
      default:
        return '☀️';
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search plants..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selected Plant Detail Panel */}
      {selectedPlant && (
        <View style={styles.selectedPanel}>
          <View style={styles.selectedHeader}>
            <View style={styles.selectedPlantInfo}>
              <Text style={styles.selectedIcon}>{selectedPlant.icon}</Text>
              <View style={styles.selectedTextContainer}>
                <Text style={styles.selectedName}>{selectedPlant.name}</Text>
                <Text style={styles.selectedScientific}>
                  {selectedPlant.scientificName}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.selectedDescription}>{selectedPlant.description}</Text>

          {/* Care Info Badges */}
          <View style={styles.careInfo}>
            <View style={styles.careBadge}>
              <Text style={styles.careBadgeIcon}>
                {getCareIcon(selectedPlant.careLevel)}
              </Text>
              <Text style={styles.careBadgeText}>
                {selectedPlant.careLevel.charAt(0).toUpperCase() +
                  selectedPlant.careLevel.slice(1)}{' '}
                care
              </Text>
            </View>
            <View style={styles.careBadge}>
              <Text style={styles.careBadgeIcon}>
                {getLightIcon(selectedPlant.lightRequirement)}
              </Text>
              <Text style={styles.careBadgeText}>
                {selectedPlant.lightRequirement.replace(/-/g, ' ')}
              </Text>
            </View>
            {selectedPlant.petSafe && (
              <View style={[styles.careBadge, styles.petSafeBadge]}>
                <Heart size={12} color="#2d5016" />
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
                <Text style={styles.optionCardIcon}>{sizeOpt.icon}</Text>
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

          {/* Placement Picker */}
          <Text style={styles.optionLabel}>Placement</Text>
          <View style={styles.optionRow}>
            {PLACEMENT_OPTIONS.filter((opt) =>
              selectedPlant.suitablePlacements.includes(opt.id)
            ).map((placementOpt) => (
              <TouchableOpacity
                key={placementOpt.id}
                style={[
                  styles.optionCard,
                  selectedPlacement === placementOpt.id && styles.optionCardSelected,
                ]}
                onPress={() => handlePlacementSelect(placementOpt.id)}
              >
                <Text style={styles.optionCardIcon}>{placementOpt.icon}</Text>
                <Text
                  style={[
                    styles.optionCardName,
                    selectedPlacement === placementOpt.id &&
                      styles.optionCardNameSelected,
                  ]}
                >
                  {placementOpt.name}
                </Text>
                <Text style={styles.optionCardDesc}>{placementOpt.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Plant Grid */}
      {!selectedPlant && (
        <>
          <Text style={styles.gridLabel}>
            {searchQuery
              ? `${filteredPlants.length} plants found`
              : 'Select a plant'}
          </Text>
          <ScrollView
            style={styles.plantGrid}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.plantGridContent}
          >
            <View style={styles.plantGridInner}>
              {filteredPlants.map((plantItem) => {
                const plant = plantItem as IndividualPlant;
                // @ts-ignore - TypeScript inference issue with filtered array
                const isSelected = selectedPlant?.id === plant.id;
                return (
                <TouchableOpacity
                  key={plant.id}
                  style={[
                    styles.plantCard,
                    isSelected && styles.plantCardSelected,
                  ]}
                  onPress={() => handlePlantSelect(plant)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.plantCardIcon}>{plant.icon}</Text>
                  <Text
                    style={styles.plantCardName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {plant.name}
                  </Text>
                  <View style={styles.plantCardBadges}>
                    <Text style={styles.plantCardBadge}>
                      {getCareIcon(plant.careLevel)}
                    </Text>
                    {plant.petSafe && (
                      <Heart size={10} color="#2d5016" />
                    )}
                  </View>
                </TouchableOpacity>
              );
              })}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1f2937',
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  plantGrid: {
    flex: 1,
    backgroundColor: '#fff',
  },
  plantGridContent: {
    paddingHorizontal: 12,
    paddingBottom: 120,
  },
  plantGridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  plantCard: {
    width: '31%',
    aspectRatio: 0.9,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    margin: '1.16%',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  plantCardSelected: {
    backgroundColor: '#ecfdf5',
    borderColor: '#2d5016',
  },
  plantCardIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  plantCardName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
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
    backgroundColor: '#fff',
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
  selectedTextContainer: {
    flex: 1,
  },
  selectedName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  selectedScientific: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  clearButton: {
    padding: 4,
  },
  selectedDescription: {
    fontSize: 14,
    color: '#4b5563',
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
    backgroundColor: '#f3f4f6',
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
    color: '#4b5563',
    textTransform: 'capitalize',
  },
  petSafeBadge: {
    backgroundColor: '#ecfdf5',
  },
  petSafeText: {
    color: '#2d5016',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
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
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: '#ecfdf5',
    borderColor: '#2d5016',
  },
  optionCardIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  optionCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  optionCardNameSelected: {
    color: '#2d5016',
  },
  optionCardDesc: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
});

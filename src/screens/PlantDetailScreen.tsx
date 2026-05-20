import React from 'react';
import {
  Image,
  ImageSourcePropType,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { PlantSearchResult } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getPlantById as getSeedPlantById } from '../data/plantDatabase';

interface PlantDetailScreenProps {
  plant: PlantSearchResult;
  onBack: () => void;
}

export const PlantDetailScreen: React.FC<PlantDetailScreenProps> = ({
  plant,
  onBack,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const imageSource = getPlantImageSource(plant);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <AppIcon name="ArrowLeft" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.heroText}>
            <Text style={[styles.plantName, { color: theme.colors.text }]}>
              {plant.name}
            </Text>
            <Text style={[styles.scientificName, { color: theme.colors.textSecondary }]}>
              {plant.scientificName}
            </Text>
          </View>
          <View style={[styles.plantImageFrame, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {imageSource ? (
              <Image source={imageSource} style={styles.plantImage} resizeMode="cover" />
            ) : (
              <Text style={[styles.plantImageFallback, { color: theme.colors.textSecondary }]}>
                No image
              </Text>
            )}
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.categoryTag}>
              <AppIcon
                name="Tag"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={[styles.categoryText, { color: theme.colors.primary }]}>
                {plant.category?.charAt(0).toUpperCase() + plant.category?.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {plant.description && (
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              About
            </Text>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
              {plant.description}
            </Text>
          </View>
        )}

        {/* Care Requirements */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Care Requirements
          </Text>
          <View style={styles.careGrid}>
            <CareItem
              icon={getCareLevelIcon(plant.careLevel)}
              label="Care Level"
              value={formatCareLevel(plant.careLevel)}
              theme={theme}
            />
            <CareItem
              icon={getLightIcon(plant.lightRequirement)}
              label="Light"
              value={formatLight(plant.lightRequirement)}
              theme={theme}
            />
            <CareItem
              icon={getWaterIcon(plant.waterRequirement)}
              label="Water"
              value={formatWater(plant.waterRequirement)}
              theme={theme}
            />
            <CareItem
              icon={plant.petSafe ? 'PawPrint' : 'Prohibit'}
              label="Pet Safety"
              value={plant.petSafe ? 'Pet Safe' : 'Toxic to Pets'}
              theme={theme}
              highlight={plant.petSafe}
            />
          </View>
        </View>

        {/* Available Sizes */}
        {plant.availableSizes && plant.availableSizes.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Available Sizes
            </Text>
            <View style={styles.sizesRow}>
              {plant.availableSizes.map((size) => (
                <View
                  key={size}
                  style={[
                    styles.sizeBadge,
                    { backgroundColor: theme.colors.borderLight },
                  ]}
                >
                  <AppIcon
                    name={getSizeIcon(size)}
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.sizeText, { color: theme.colors.text }]}>
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Suitable Placements */}
        {plant.suitablePlacements && plant.suitablePlacements.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Best Placed On
            </Text>
            <View style={styles.placementsRow}>
              {plant.suitablePlacements.map((placement) => (
                <View
                  key={placement}
                  style={[
                    styles.placementBadge,
                    { backgroundColor: theme.colors.borderLight },
                  ]}
                >
                  <AppIcon
                    name={getPlacementIcon(placement)}
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.placementText, { color: theme.colors.text }]}>
                    {placement.charAt(0).toUpperCase() + placement.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
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

function CareItem({
  icon,
  label,
  value,
  theme,
  highlight = false,
}: {
  icon: string;
  label: string;
  value: string;
  theme: any;
  highlight?: boolean;
}) {
  return (
    <View style={styles.careItem}>
      <View
        style={[
          styles.careIconContainer,
          { backgroundColor: highlight ? `${theme.colors.primary}15` : theme.colors.borderLight },
        ]}
      >
        <AppIcon
          name={icon}
          size={24}
          color={highlight ? theme.colors.primary : theme.colors.textSecondary}
        />
      </View>
      <Text style={[styles.careLabel, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.careValue,
          { color: highlight ? theme.colors.primary : theme.colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function getCareLevelIcon(level: string): string {
  switch (level?.toLowerCase()) {
    case 'easy': return 'Smiley';
    case 'moderate': return 'Equals';
    case 'difficult': return 'Warning';
    default: return 'Question';
  }
}

function formatCareLevel(level: string): string {
  switch (level?.toLowerCase()) {
    case 'easy': return 'Easy';
    case 'moderate': return 'Moderate';
    case 'difficult': return 'Expert';
    default: return level || 'Unknown';
  }
}

function getLightIcon(light: string): string {
  switch (light?.toLowerCase()) {
    case 'low': return 'Moon';
    case 'low-to-bright': return 'SunHorizon';
    case 'bright-indirect': return 'CloudSun';
    case 'bright-direct': return 'Sun';
    default: return 'Question';
  }
}

function formatLight(light: string): string {
  switch (light?.toLowerCase()) {
    case 'low': return 'Low Light';
    case 'low-to-bright': return 'Adaptable';
    case 'bright-indirect': return 'Bright Indirect';
    case 'bright-direct': return 'Direct Sun';
    default: return light || 'Unknown';
  }
}

function getWaterIcon(water?: string): string {
  switch (water?.toLowerCase()) {
    case 'low': return 'Drop';
    case 'moderate': return 'DropHalf';
    case 'high': return 'DropHalfBottom';
    default: return 'Question';
  }
}

function formatWater(water?: string): string {
  switch (water?.toLowerCase()) {
    case 'low': return 'Low';
    case 'moderate': return 'Moderate';
    case 'high': return 'High';
    default: return water || 'Unknown';
  }
}

function getSizeIcon(size: string): string {
  switch (size) {
    case 'small': return 'ArrowDown';
    case 'medium': return 'ArrowsOutVertical';
    case 'large': return 'ArrowUp';
    default: return 'Ruler';
  }
}

function getPlacementIcon(placement: string): string {
  switch (placement) {
    case 'floor': return 'Square';
    case 'shelf': return 'Tray';
    case 'hanging': return 'CornersOut';
    case 'auto': return 'MagicWand';
    default: return 'Question';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  heroCard: {
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  plantImageFrame: {
    width: '100%',
    aspectRatio: 1.25,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plantImage: {
    width: '100%',
    height: '100%',
  },
  plantImageFallback: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroText: {
    gap: 5,
  },
  plantName: {
    fontSize: 26,
    fontWeight: '700',
  },
  scientificName: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  heroMeta: {
    alignItems: 'flex-start',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  careGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  careItem: {
    width: '45%',
    alignItems: 'center',
    gap: 6,
  },
  careIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  careLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  careValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sizesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  sizeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placementsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  placementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  placementText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

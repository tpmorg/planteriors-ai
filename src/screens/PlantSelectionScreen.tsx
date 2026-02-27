import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import {
  PlantType,
  PlantStyle,
  PotStyle,
  PotColor,
  MaintenanceLevel,
  PlacementDensity,
  PlantOptions,
  PlantSelectionMode,
  IndividualPlantSelection,
  GenerationRequest,
} from '../types';
import { PlantModeToggle } from '../components/PlantModeToggle';
import { IndividualPlantSelector } from '../components/IndividualPlantSelector';
import { useTheme } from '../contexts/ThemeContext';

interface PlantSelectionScreenProps {
  imageUri: string;
  onPlantSelected: (request: Omit<GenerationRequest, 'imageUri'>) => void;
  onBack: () => void;
}

// Plant Types Data
const PLANT_TYPES: PlantType[] = [
  {
    id: 'succulents',
    name: 'Succulents',
    description: 'Low-maintenance, water-storing plants',
    icon: 'Cactus',
    styles: [
      { id: 'modern', name: 'Modern', description: 'Clean, geometric arrangements', icon: 'Lightning' },
      { id: 'rustic', name: 'Rustic', description: 'Natural, organic feel', icon: 'Tree' },
      { id: 'minimalist', name: 'Minimalist', description: 'Simple, elegant displays', icon: 'Circle' },
    ],
  },
  {
    id: 'tropical',
    name: 'Tropical',
    description: 'Lush, green foliage plants',
    icon: 'Leaf',
    styles: [
      { id: 'jungle', name: 'Jungle', description: 'Dense, wild arrangements', icon: 'Tree' },
      { id: 'contemporary', name: 'Contemporary', description: 'Stylish, curated look', icon: 'StarFour' },
      { id: 'bohemian', name: 'Bohemian', description: 'Eclectic, artistic vibe', icon: 'PaintBrush' },
    ],
  },
  {
    id: 'flowering',
    name: 'Flowering',
    description: 'Colorful blooms and flowers',
    icon: 'Flower',
    styles: [
      { id: 'cottage', name: 'Cottage', description: 'Charming, homey feel', icon: 'House' },
      { id: 'elegant', name: 'Elegant', description: 'Sophisticated arrangements', icon: 'Crown' },
      { id: 'vibrant', name: 'Vibrant', description: 'Bold, colorful displays', icon: 'Palette' },
    ],
  },
  {
    id: 'hanging',
    name: 'Hanging',
    description: 'Trailing and cascading plants',
    icon: 'Plant',
    styles: [
      { id: 'cascading', name: 'Cascading', description: 'Flowing, waterfall effect', icon: 'Drop' },
      { id: 'structured', name: 'Structured', description: 'Organized, planned layout', icon: 'Ruler' },
      { id: 'natural', name: 'Natural', description: 'Organic, free-flowing', icon: 'Leaf' },
    ],
  },
];

// Pot Styles Data
const POT_STYLES: PotStyle[] = [
  { id: 'ceramic', name: 'Ceramic', icon: 'PottedPlant' },
  { id: 'terracotta', name: 'Terracotta', icon: 'CookingPot' },
  { id: 'modern', name: 'Modern', icon: 'Square' },
  { id: 'woven', name: 'Woven', icon: 'Basket' },
  { id: 'concrete', name: 'Concrete', icon: 'Cube' },
];

// Pot Colors Data
const POT_COLORS: PotColor[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF' },
  { id: 'black', name: 'Black', hex: '#2D2D2D' },
  { id: 'terracotta', name: 'Terracotta', hex: '#C45C3E' },
  { id: 'sage', name: 'Sage', hex: '#9CAF88' },
  { id: 'navy', name: 'Navy', hex: '#1E3A5F' },
  { id: 'cream', name: 'Cream', hex: '#F5F5DC' },
];

// Maintenance Levels Data
const MAINTENANCE_LEVELS: MaintenanceLevel[] = [
  { id: 'low', name: 'Low', description: 'Minimal care needed', icon: 'BatteryLow' },
  { id: 'medium', name: 'Medium', description: 'Regular attention', icon: 'BatteryMedium' },
  { id: 'high', name: 'High', description: 'Daily care required', icon: 'BatteryHigh' },
];

// Placement Density Data
const PLACEMENT_DENSITIES: PlacementDensity[] = [
  { id: 'sparse', name: 'Sparse', description: 'Few accent plants', icon: 'Plant' },
  { id: 'moderate', name: 'Moderate', description: 'Balanced arrangement', icon: 'Leaf' },
  { id: 'lush', name: 'Lush', description: 'Abundant greenery', icon: 'Tree' },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const PlantSelectionScreen: React.FC<PlantSelectionScreenProps> = ({
  imageUri,
  onPlantSelected,
  onBack,
}) => {
  const insets = useSafeAreaInsets();

  // Mode state
  const [mode, setMode] = useState<PlantSelectionMode>('individual');

  // Individual plant selection state
  const [individualSelection, setIndividualSelection] = useState<IndividualPlantSelection | null>(null);
  const [isPlantSearchActive, setIsPlantSearchActive] = useState(false);

  // Multi-plant selection state
  const [selectedPlantType, setSelectedPlantType] = useState<PlantType | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<PlantStyle | null>(null);

  // Options state
  const [selectedPotStyle, setSelectedPotStyle] = useState<PotStyle>(POT_STYLES[0]);
  const [selectedPotColor, setSelectedPotColor] = useState<PotColor>(POT_COLORS[0]);
  const [usePlanterBox, setUsePlanterBox] = useState(false);
  const [maintenanceLevel, setMaintenanceLevel] = useState<MaintenanceLevel>(MAINTENANCE_LEVELS[0]);
  const [placementDensity, setPlacementDensity] = useState<PlacementDensity>(PLACEMENT_DENSITIES[1]);

  // Expanded sections state
  const [expandedSection, setExpandedSection] = useState<string | null>('plants');

  const { theme } = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [isPlantSearchActive, individualSelection]);

  useEffect(() => {
    if (mode !== 'individual') {
      setIsPlantSearchActive(false);
    }
  }, [mode]);

  const handlePlantTypeSelect = (plantType: PlantType) => {
    setSelectedPlantType(plantType);
    setSelectedStyle(null);
  };

  const handleStyleSelect = (style: PlantStyle) => {
    setSelectedStyle(style);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleContinue = () => {
    if (mode === 'multi-plant') {
      if (selectedPlantType && selectedStyle) {
        const plantOptions: PlantOptions = {
          potStyle: selectedPotStyle,
          potColor: selectedPotColor,
          usePlanterBox,
          maintenanceLevel,
          placementDensity,
        };
        onPlantSelected({
          mode: 'multi-plant',
          plantType: selectedPlantType,
          plantStyle: selectedStyle,
          plantOptions,
        });
      }
    } else {
      if (individualSelection) {
        onPlantSelected({
          mode: 'individual',
          individualPlant: individualSelection,
        });
      }
    }
  };

  const isComplete = mode === 'multi-plant'
    ? selectedPlantType && selectedStyle
    : individualSelection !== null;

  // Section Header Component
  const SectionHeader = ({
    title,
    subtitle,
    section,
    isComplete: sectionComplete,
  }: {
    title: string;
    subtitle: string;
    section: string;
    isComplete?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => toggleSection(section)}
      activeOpacity={0.7}
    >
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionIndicator, sectionComplete && styles.sectionIndicatorComplete]}>
          {sectionComplete ? (
            <AppIcon name="Check" size={14} color="#fff" />
          ) : (
            <View style={styles.sectionIndicatorDot} />
          )}
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {expandedSection === section ? (
        <AppIcon name="CaretUp" size={20} color={theme.colors.textSecondary} />
      ) : (
        <AppIcon name="CaretDown" size={20} color={theme.colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <AppIcon name="ArrowLeft" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Design Your Space</Text>
        <View style={styles.placeholder} />
      </View>

      {mode === 'individual' ? (
        <IndividualPlantSelector
          selection={individualSelection}
          onSelectionChange={setIndividualSelection}
          onSearchActiveChange={setIsPlantSearchActive}
          listFooterSpacerHeight={
            isPlantSearchActive && !individualSelection
              ? 24 + insets.bottom
              : 120 + insets.bottom
          }
          listHeader={
            <>
              {/* Hero Section with Explanation */}
              {(!isPlantSearchActive || individualSelection) && (
                <View style={styles.heroSection}>
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  </View>
                  <View style={styles.heroContent}>
                    <Text style={styles.heroTitle}>Transform Your Room</Text>
                    <Text style={styles.heroDescription}>
                      Choose a specific plant to see how it would look in your space.
                    </Text>
                  </View>
                </View>
              )}

              {/* Mode Toggle */}
              <PlantModeToggle mode={mode} onModeChange={setMode} />
            </>
          }
        />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Section with Explanation */}
          <View style={styles.heroSection}>
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            </View>
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>Transform Your Room</Text>
              <Text style={styles.heroDescription}>
                Customize your plant design by selecting the type of plants, pot styles, and
                placement preferences.
              </Text>
            </View>
          </View>

          {/* Mode Toggle */}
          <PlantModeToggle mode={mode} onModeChange={setMode} />

          {/* Multi-Plant Mode - Plant Type & Style Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Plant Selection"
            subtitle={selectedPlantType ? `${selectedPlantType.name} • ${selectedStyle?.name || 'Choose style'}` : 'Choose your plants'}
            section="plants"
            isComplete={!!selectedPlantType && !!selectedStyle}
          />

          {expandedSection === 'plants' && (
            <View style={styles.sectionContent}>
              {/* Plant Type Grid */}
              <Text style={styles.subsectionLabel}>Plant Type</Text>
              <View style={styles.plantGrid}>
                {PLANT_TYPES.map((plantType) => (
                  <TouchableOpacity
                    key={plantType.id}
                    style={[
                      styles.plantCard,
                      selectedPlantType?.id === plantType.id && styles.plantCardSelected,
                    ]}
                    onPress={() => handlePlantTypeSelect(plantType)}
                  >
                    <AppIcon
                      name={plantType.icon}
                      size={24}
                      color={theme.colors.primary}
                      style={styles.plantIcon}
                    />
                    <Text style={[
                      styles.plantName,
                      selectedPlantType?.id === plantType.id && styles.plantNameSelected,
                    ]}>
                      {plantType.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Style Selection */}
              {selectedPlantType && (
                <>
                  <Text style={styles.subsectionLabel}>Style</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.styleScroll}>
                    {selectedPlantType.styles.map((style) => (
                      <TouchableOpacity
                        key={style.id}
                        style={[
                          styles.styleChip,
                          selectedStyle?.id === style.id && styles.styleChipSelected,
                        ]}
                        onPress={() => handleStyleSelect(style)}
                      >
                        <AppIcon
                          name={style.icon}
                          size={18}
                          color={theme.colors.primary}
                          style={styles.styleChipIcon}
                        />
                        <View style={styles.styleChipText}>
                          <Text style={[
                            styles.styleChipName,
                            selectedStyle?.id === style.id && styles.styleChipNameSelected,
                          ]}>
                            {style.name}
                          </Text>
                          <Text style={styles.styleChipDesc}>{style.description}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          )}
        </View>

        {/* Pot & Container Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Pots & Containers"
            subtitle={`${selectedPotStyle.name} • ${selectedPotColor.name}${usePlanterBox ? ' • Planter Box' : ''}`}
            section="pots"
          />

          {expandedSection === 'pots' && (
            <View style={styles.sectionContent}>
              {/* Pot Style */}
              <Text style={styles.subsectionLabel}>Pot Style</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroll}>
                {POT_STYLES.map((pot) => (
                  <TouchableOpacity
                    key={pot.id}
                    style={[
                      styles.optionChip,
                      selectedPotStyle.id === pot.id && styles.optionChipSelected,
                    ]}
                    onPress={() => setSelectedPotStyle(pot)}
                  >
                    <AppIcon
                      name={pot.icon}
                      size={18}
                      color={theme.colors.primary}
                      style={styles.optionChipIcon}
                    />
                    <Text style={[
                      styles.optionChipLabel,
                      selectedPotStyle.id === pot.id && styles.optionChipLabelSelected,
                    ]}>
                      {pot.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Pot Color */}
              <Text style={styles.subsectionLabel}>Pot Color</Text>
              <View style={styles.colorGrid}>
                {POT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color.id}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color.hex },
                      selectedPotColor.id === color.id && styles.colorSwatchSelected,
                      color.id === 'white' && styles.colorSwatchBorder,
                    ]}
                    onPress={() => setSelectedPotColor(color)}
                  >
                    {selectedPotColor.id === color.id && (
                      <AppIcon
                        name="Check"
                        size={18}
                        color={color.id === 'white' || color.id === 'cream' ? theme.colors.primary : '#fff'}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.colorLabel}>{selectedPotColor.name}</Text>

              {/* Planter Box Toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Use Planter Boxes</Text>
                  <Text style={styles.toggleDesc}>Include wooden or decorative planter boxes</Text>
                </View>
                <Switch
                  value={usePlanterBox}
                  onValueChange={setUsePlanterBox}
                  trackColor={{ false: theme.colors.switchTrackFalse, true: theme.colors.switchTrackTrue }}
                  thumbColor={theme.colors.switchThumb}
                />
              </View>
            </View>
          )}
        </View>

        {/* Maintenance Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Care Level"
            subtitle={`${maintenanceLevel.name} maintenance`}
            section="maintenance"
          />

          {expandedSection === 'maintenance' && (
            <View style={styles.sectionContent}>
              <Text style={styles.subsectionLabel}>How much care can you provide?</Text>
              <View style={styles.levelGrid}>
                {MAINTENANCE_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level.id}
                    style={[
                      styles.levelCard,
                      maintenanceLevel.id === level.id && styles.levelCardSelected,
                    ]}
                    onPress={() => setMaintenanceLevel(level)}
                  >
                    <AppIcon
                      name={level.icon}
                      size={20}
                      color={theme.colors.primary}
                      style={styles.levelIcon}
                    />
                    <Text style={[
                      styles.levelName,
                      maintenanceLevel.id === level.id && styles.levelNameSelected,
                    ]}>
                      {level.name}
                    </Text>
                    <Text style={styles.levelDesc}>{level.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Density Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Plant Density"
            subtitle={`${placementDensity.name} placement`}
            section="density"
          />

          {expandedSection === 'density' && (
            <View style={styles.sectionContent}>
              <Text style={styles.subsectionLabel}>How many plants do you want?</Text>
              <View style={styles.densitySlider}>
                {PLACEMENT_DENSITIES.map((density) => (
                  <TouchableOpacity
                    key={density.id}
                    style={[
                      styles.densityOption,
                      placementDensity.id === density.id && styles.densityOptionSelected,
                    ]}
                    onPress={() => setPlacementDensity(density)}
                  >
                    <AppIcon
                      name={density.icon}
                      size={20}
                      color={theme.colors.primary}
                      style={styles.densityIcon}
                    />
                    <Text style={[
                      styles.densityName,
                      placementDensity.id === density.id && styles.densityNameSelected,
                    ]}>
                      {density.name}
                    </Text>
                    <Text style={styles.densityDesc}>{density.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
        {/* Bottom spacing for footer */}
        <View style={{ height: 120 + insets.bottom }} />
        </ScrollView>
      )}

      {/* Fixed Footer */}
      {!(mode === 'individual' && isPlantSearchActive && !individualSelection) && (
        <View style={[styles.footer, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.footerContent}>
            {!isComplete ? (
              <Text style={styles.footerHint}>
                {mode === 'multi-plant'
                  ? 'Select a plant type and style to continue'
                  : 'Select a plant and size to continue'}
              </Text>
            ) : (
              <View style={styles.selectionPreview}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppIcon
                    name={
                      mode === 'multi-plant'
                        ? selectedPlantType?.icon || 'Leaf'
                        : individualSelection?.plant.icon || 'Leaf'
                    }
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.selectionPreviewText}>
                    {mode === 'multi-plant'
                      ? `${selectedPlantType?.name} • ${selectedStyle?.name}`
                      : `${individualSelection?.plant.name} • ${individualSelection?.size}`}
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[styles.continueButton, !isComplete && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={!isComplete}
            >
              <Text style={styles.continueButtonText}>
                {mode === 'multi-plant' ? 'Generate Design' : 'Choose Placement'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => {
  const selectedBg = theme.isDark ? 'rgba(134, 239, 172, 0.15)' : '#ecfdf5';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backdropBlobA: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: theme.isDark ? 'rgba(143,179,154,0.1)' : 'rgba(78,107,87,0.08)',
      top: -70,
      right: -80,
    },
    backdropBlobB: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: theme.isDark ? 'rgba(181,122,82,0.08)' : 'rgba(181,122,82,0.08)',
      bottom: 120,
      left: -90,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: 'transparent',
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'serif',
      letterSpacing: 0.2,
    },
    placeholder: {
      width: 40,
    },
    content: {
      flex: 1,
    },

    // Hero Section
    heroSection: {
      backgroundColor: theme.colors.surface,
      marginBottom: 12,
      borderRadius: 20,
      marginHorizontal: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.isDark ? 0.26 : 0.12,
      shadowRadius: 14,
      elevation: 8,
    },
    imageContainer: {
      height: 240,
      position: 'relative',
      backgroundColor: theme.colors.borderLight,
    },
    previewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    heroContent: {
      padding: 20,
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 10,
      fontFamily: 'serif',
      letterSpacing: 0.2,
    },
    heroDescription: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },

    // Sections
    section: {
      backgroundColor: theme.colors.surface,
      marginBottom: 12,
      marginHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.isDark ? 0.24 : 0.1,
      shadowRadius: 12,
      elevation: 7,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    sectionHeaderText: {
      flex: 1,
    },
    sectionIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    sectionIndicatorComplete: {
      backgroundColor: theme.colors.primary,
    },
    sectionIndicatorDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.textSecondary,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    sectionContent: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    subsectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
      marginTop: 8,
    },

    // Plant Grid
    plantGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    plantCard: {
      width: '23%',
      aspectRatio: 1,
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      margin: '1%',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    plantCardSelected: {
      backgroundColor: selectedBg,
      borderColor: theme.colors.primary,
    },
    plantIcon: {
      fontSize: 28,
      marginBottom: 4,
    },
    plantName: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    plantNameSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },

    // Style Chips
    styleScroll: {
      marginHorizontal: -16,
      paddingHorizontal: 16,
    },
    styleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      padding: 12,
      marginRight: 10,
      borderWidth: 2,
      borderColor: 'transparent',
      minWidth: 160,
    },
    styleChipSelected: {
      backgroundColor: selectedBg,
      borderColor: theme.colors.primary,
    },
    styleChipIcon: {
      fontSize: 24,
      marginRight: 10,
    },
    styleChipText: {
      flex: 1,
    },
    styleChipName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    styleChipNameSelected: {
      color: theme.colors.primary,
    },
    styleChipDesc: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },

    // Option Chips
    optionScroll: {
      marginHorizontal: -16,
      paddingHorizontal: 16,
    },
    optionChip: {
      alignItems: 'center',
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      padding: 12,
      marginRight: 10,
      minWidth: 80,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    optionChipSelected: {
      backgroundColor: selectedBg,
      borderColor: theme.colors.primary,
    },
    optionChipIcon: {
      fontSize: 24,
      marginBottom: 4,
    },
    optionChipLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    optionChipLabelSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },

    // Color Swatches
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    colorSwatch: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 12,
      marginBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchSelected: {
      borderWidth: 3,
      borderColor: theme.colors.primary,
    },
    colorSwatchBorder: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    colorLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },

    // Toggle Row
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      padding: 16,
    },
    toggleInfo: {
      flex: 1,
      marginRight: 16,
    },
    toggleLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    toggleDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },

    // Level Cards
    levelGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    levelCard: {
      flex: 1,
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 4,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    levelCardSelected: {
      backgroundColor: selectedBg,
      borderColor: theme.colors.primary,
    },
    levelIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    levelName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    levelNameSelected: {
      color: theme.colors.primary,
    },
    levelDesc: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },

    // Density Options
    densitySlider: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    densityOption: {
      flex: 1,
      backgroundColor: theme.colors.borderLight,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 4,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    densityOptionSelected: {
      backgroundColor: selectedBg,
      borderColor: theme.colors.primary,
    },
    densityIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    densityName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    densityNameSelected: {
      color: theme.colors.primary,
    },
    densityDesc: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },

    // Footer
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingBottom: 24,
    },
    footerContent: {
      padding: 16,
    },
    footerHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
    },
    selectionPreview: {
      marginBottom: 12,
    },
    selectionPreviewText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
      textAlign: 'center',
    },
    continueButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 17,
      paddingHorizontal: 24,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.isDark ? 0.35 : 0.2,
      shadowRadius: 10,
      elevation: 8,
    },
    continueButtonDisabled: {
      backgroundColor: '#9ca3af',
    },
    continueButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });
};

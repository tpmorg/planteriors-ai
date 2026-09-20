import React from 'react';
import {
  Image,
  ImageBackground,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { AppIcon } from './AppIcon';

export interface PlantCatalogCardPlant {
  id: string;
  name: string;
  scientificName: string;
  category: string;
  petSafe: boolean;
  lightRequirement: string;
  careLevel: string;
  icon?: string;
  userAdded?: boolean;
}

interface PlantCatalogCardProps {
  plant: PlantCatalogCardPlant;
  imageSource?: ImageSourcePropType;
  onPress: () => void;
  variant?: 'hero' | 'compact';
  metadata?: string[];
  accessibilityLabel?: string;
}

function formatLightLabel(lightRequirement: string) {
  switch (lightRequirement) {
    case 'low': return 'Low light';
    case 'low-to-bright': return 'Flexible light';
    case 'bright-direct': return 'Direct sun';
    case 'bright-indirect': return 'Bright indirect';
    default: return lightRequirement;
  }
}

function formatCareLabel(careLevel: string) {
  switch (careLevel) {
    case 'easy': return 'Easy care';
    case 'moderate': return 'Moderate care';
    case 'difficult': return 'Advanced care';
    default: return careLevel;
  }
}

export const PlantCatalogCard = React.memo(function PlantCatalogCard({
  plant,
  imageSource,
  onPress,
  variant = 'compact',
  metadata,
  accessibilityLabel,
}: PlantCatalogCardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const labels = metadata || (plant.petSafe
    ? ['Pet safe', formatLightLabel(plant.lightRequirement)]
    : [formatCareLabel(plant.careLevel), formatLightLabel(plant.lightRequirement)]);

  if (variant === 'hero') {
    return (
      <Pressable
        style={({ pressed }) => [styles.heroCard, pressed && styles.cardPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || `Open ${plant.name}`}
      >
        {imageSource ? (
          <ImageBackground source={imageSource} style={styles.heroFrame} imageStyle={styles.heroImage}>
            <View style={styles.heroOverlay} />
            {plant.userAdded ? <ImportedBadge /> : null}
            <HeroCopy plant={plant} labels={labels} hasImage />
          </ImageBackground>
        ) : (
          <View style={[styles.heroFrame, styles.heroFallback]}>
            <AppIcon name={plant.icon || 'Leaf'} size={56} color={theme.colors.primary} weight="fill" />
            {plant.userAdded ? <ImportedBadge /> : null}
            <HeroCopy plant={plant} labels={labels} />
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.compactCard, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `Choose ${plant.name}`}
    >
      <View style={styles.thumbnailFrame}>
        {imageSource ? (
          <Image source={imageSource} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <AppIcon name={plant.icon || 'Leaf'} size={30} color={theme.colors.primary} weight="fill" />
        )}
        {plant.userAdded ? <ImportedBadge compact /> : null}
      </View>
      <View style={styles.compactCopy}>
        <Text style={styles.compactCategory} numberOfLines={1}>{plant.category}</Text>
        <Text style={styles.compactName} numberOfLines={1}>{plant.name}</Text>
        <Text style={styles.compactScientific} numberOfLines={1}>{plant.scientificName}</Text>
        <Text style={styles.compactMeta} numberOfLines={1}>{labels.join(' • ')}</Text>
      </View>
      <AppIcon name="CaretRight" size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
});

function ImportedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[sharedStyles.importedBadge, compact && sharedStyles.importedBadgeCompact]}>
      <Text style={[sharedStyles.importedBadgeText, compact && sharedStyles.importedBadgeTextCompact]}>Imported</Text>
    </View>
  );
}

function HeroCopy({ plant, labels, hasImage = false }: {
  plant: PlantCatalogCardPlant;
  labels: string[];
  hasImage?: boolean;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.heroCopy}>
      <Text style={[styles.heroCategory, !hasImage && { color: theme.colors.textSecondary }]} numberOfLines={1}>{plant.category}</Text>
      <Text style={[styles.heroName, !hasImage && { color: theme.colors.text }]} numberOfLines={1}>{plant.name}</Text>
      <Text style={[styles.heroScientific, !hasImage && { color: theme.colors.textSecondary }]} numberOfLines={1}>{plant.scientificName}</Text>
      <View style={styles.metadataRow}>
        {labels.map((label) => (
          <View key={`${plant.id}-${label}`} style={[styles.metadataChip, !hasImage && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : '#f6f7f4', borderColor: theme.colors.border }]}>
            <Text style={[styles.metadataChipText, !hasImage && { color: theme.colors.textSecondary }]} numberOfLines={1}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  importedBadge: { position: 'absolute', top: 12, right: 12, borderRadius: 12, backgroundColor: 'rgba(47,122,82,0.92)', paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  importedBadgeCompact: { top: 6, right: 6, paddingHorizontal: 5, paddingVertical: 3 },
  importedBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  importedBadgeTextCompact: { fontSize: 8 },
});

const createStyles = (theme: any) => StyleSheet.create({
  heroCard: { overflow: 'hidden' },
  heroFrame: { width: '100%', minHeight: 220, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  heroFallback: { alignItems: 'flex-start', backgroundColor: theme.colors.surface },
  heroCopy: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 18, justifyContent: 'flex-end' },
  heroCategory: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: '#f3f5f2' },
  heroName: { marginTop: 4, fontSize: 24, fontWeight: '700', color: '#ffffff' },
  heroScientific: { marginTop: 2, fontSize: 14, fontStyle: 'italic', color: 'rgba(255,255,255,0.82)' },
  metadataRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metadataChip: { maxWidth: '100%', minHeight: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(0,0,0,0.36)', paddingHorizontal: 9, paddingVertical: 5, justifyContent: 'center' },
  metadataChipText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  compactCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingRight: 12 },
  thumbnailFrame: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.borderLight },
  thumbnail: { width: '100%', height: '100%' },
  compactCopy: { flex: 1, minWidth: 0 },
  compactCategory: { color: theme.colors.primary, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  compactName: { color: theme.colors.text, fontSize: 16, lineHeight: 20, fontWeight: '800', marginTop: 3 },
  compactScientific: { color: theme.colors.textSecondary, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  compactMeta: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '600', marginTop: 7, textTransform: 'capitalize' },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});

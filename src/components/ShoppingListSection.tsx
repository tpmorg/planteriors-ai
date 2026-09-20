import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
} from 'react-native';
import { AppIcon } from './AppIcon';
import { AppButton } from './AppButton';
import { useTheme } from '../contexts/ThemeContext';
import { IdentifiedDesignPlant, SavedDesign } from '../types';
import * as WebBrowser from 'expo-web-browser';

interface ShoppingListSectionProps {
  design: SavedDesign;
  onFindNearby: (plantName: string) => void;
}

interface ShopItemProps {
  name: string;
  subtitle?: string;
  meta?: string;
  theme: any;
  onFindNearby: () => void;
  onBuyOnline: () => void;
}

function PlantShopItem({ name, subtitle, meta, theme, onFindNearby, onBuyOnline }: ShopItemProps) {
  return (
    <View style={[styles.item, { backgroundColor: theme.colors.borderLight, borderColor: theme.colors.border }]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemIcon}>
          <AppIcon name="Plant" size={18} color={theme.colors.primary} weight="fill" />
        </View>
        <View style={styles.itemText}>
          <Text style={[styles.itemName, { color: theme.colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          {subtitle && (
            <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {meta && (
            <Text style={[styles.itemMeta, { color: theme.colors.primary }]}>
              {meta}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.itemActions}>
        <AppButton
          variant="primary"
          size="sm"
          icon="MapPin"
          title="Find Nearby"
          onPress={onFindNearby}
          accessibilityLabel={`Find ${name} at nearby shops`}
          style={styles.actionButton}
        />
        <AppButton
          variant="secondary"
          size="sm"
          icon="ShoppingCart"
          title="Buy Online"
          onPress={onBuyOnline}
          accessibilityLabel={`Search for ${name} online`}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

export const ShoppingListSection: React.FC<ShoppingListSectionProps> = ({
  design,
  onFindNearby,
}) => {
  const { theme } = useTheme();

  const openBuyOnline = async (plantName: string) => {
    const searchQuery = encodeURIComponent(`${plantName} plant for sale`);
    const url = `https://www.google.com/search?tbm=shop&q=${searchQuery}`;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      await Linking.openURL(url);
    }
  };

  // Multi-plant mode: use generatedPlants
  if (design.mode === 'multi-plant' && design.generatedPlants && design.generatedPlants.length > 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Shopping List</Text>
        <View style={styles.list}>
          {design.generatedPlants.map((plant, index) => (
            <PlantShopItem
              key={`${plant.commonName}-${index}`}
              name={plant.commonName}
              subtitle={plant.scientificName}
              meta={`${plant.careLevel} care • ${plant.placement}`}
              theme={theme}
              onFindNearby={() => onFindNearby(plant.commonName)}
              onBuyOnline={() => openBuyOnline(plant.commonName)}
            />
          ))}
        </View>
      </View>
    );
  }

  // Individual plant mode
  if (
    (design.mode === 'individual' || design.mode === 'replace-plant') &&
    design.individualPlant
  ) {
    const plant = design.individualPlant;
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Shopping List</Text>
        <PlantShopItem
          name={plant.name}
          subtitle={plant.scientificName}
          meta={`${plant.size} • ${plant.placement}`}
          theme={theme}
          onFindNearby={() => onFindNearby(plant.name)}
          onBuyOnline={() => openBuyOnline(plant.name)}
        />
      </View>
    );
  }

  // No plants to show (shouldn't happen often)
  if (design.mode === 'multi-plant' && (!design.generatedPlants || design.generatedPlants.length === 0)) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Shopping List</Text>
        <View style={[styles.identifyPrompt, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppIcon name="MagnifyingGlass" size={18} color={theme.colors.primary} />
          <Text style={[styles.identifyPromptText, { color: theme.colors.textSecondary }]}>
            Identify plants in this design to build a shopping list
          </Text>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  list: {
    gap: 10,
  },
  item: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(143,179,154,0.14)',
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  itemMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  identifyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  identifyPromptText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});

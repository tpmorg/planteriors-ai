import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../components/AppIcon';
import { AppButton } from '../components/AppButton';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { Collection, SavedDesign } from '../types';
import { databaseService } from '../services/databaseService';
import { useAuth } from '../contexts/AuthContext';
import { useLibraryDataVersion } from '../hooks/useLibraryDataVersion';

interface FavoritesScreenProps {
  onDesignSelect: (design: SavedDesign, designs: SavedDesign[], initialIndex: number) => void;
}

interface CollectionSummary {
  collection: Collection;
  designs: SavedDesign[];
}

interface DesignCardProps {
  design: SavedDesign;
  itemSize: number;
  onPress: () => void;
  theme: any;
  styles: ReturnType<typeof createStyles>;
}

const getImageUri = (design: SavedDesign) => design.localImagePath || design.generatedImageUri;

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const DesignCard = React.memo(({ design, itemSize, onPress, theme, styles }: DesignCardProps) => {
  const isSinglePlantDesign =
    (design.mode === 'individual' || design.mode === 'replace-plant') && design.individualPlant;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.designItem, { width: itemSize }, pressed && styles.designItemPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${isSinglePlantDesign ? design.individualPlant!.name : design.plantType?.name || 'design'}`}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: getImageUri(design) }} style={styles.designImage} resizeMode="cover" />

        <View style={styles.favoriteBadge}>
          <AppIcon name="Heart" size={16} color="#dc2626" weight="fill" />
        </View>

        <View style={styles.infoOverlay}>
          <Text style={styles.plantTypeText} numberOfLines={1}>
            {isSinglePlantDesign
              ? design.individualPlant!.name
              : design.plantType?.name || 'Custom'}
          </Text>
          <Text style={styles.plantStyleText} numberOfLines={1}>
            {isSinglePlantDesign
              ? design.mode === 'replace-plant'
                ? `${design.individualPlant!.size} • replacement`
                : `${design.individualPlant!.size} • ${design.individualPlant!.placement}`
              : design.plantStyle?.name || 'Design'}
          </Text>
        </View>
      </View>

      <Text style={styles.dateText}>{formatDate(design.createdAt)}</Text>
    </Pressable>
  );
});

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ onDesignSelect }) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const libraryDataVersion = useLibraryDataVersion();

  const isTablet = Platform.OS === 'ios' && Math.min(width, height) >= 768;
  const numColumns = isTablet ? (width >= 1180 ? 4 : 3) : 2;
  const listHorizontalPadding = isTablet ? 24 : 16;
  const interItemGap = isTablet ? 14 : 12;
  const itemSize = Math.floor(
    (width - listHorizontalPadding * 2 - interItemGap * (numColumns - 1)) / numColumns
  );

  const loadData = useCallback(async () => {
    try {
      const [savedDesigns, savedCollections] = await Promise.all([
        databaseService.getAllDesigns(user?.id),
        databaseService.getCollections(user?.id),
      ]);

      setDesigns(savedDesigns);
      setCollections(savedCollections);
    } catch (error) {
      console.error('Failed to load favorites data:', error);
      Alert.alert('Error', 'Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData, libraryDataVersion]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const favoriteDesigns = useMemo(
    () => designs.filter((design) => design.isFavorite),
    [designs]
  );

  const collectionSummaries = useMemo<CollectionSummary[]>(
    () =>
      collections.map((collection) => ({
        collection,
        designs: designs.filter((design) => design.collectionId === collection.id),
      })),
    [collections, designs]
  );

  const favoriteRows = useMemo(
    () => chunkDesigns(favoriteDesigns, numColumns),
    [favoriteDesigns, numColumns]
  );

  const handleStartCollection = useCallback(() => {
    setIsCreatingCollection(true);
  }, []);

  const handleCancelCollection = useCallback(() => {
    if (isSavingCollection) {
      return;
    }

    setIsCreatingCollection(false);
    setNewCollectionName('');
  }, [isSavingCollection]);

  const handleCreateCollection = useCallback(async () => {
    const trimmedName = newCollectionName.trim();
    if (!trimmedName) {
      Alert.alert('Collection name required', 'Give your collection a short name.');
      return;
    }

    try {
      setIsSavingCollection(true);
      const created = await databaseService.createCollection(trimmedName, user?.id);
      setCollections((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCollectionName('');
      setIsCreatingCollection(false);
    } catch (error) {
      console.error('Failed to create collection:', error);
      Alert.alert('Could not create collection', 'Try a different name and try again.');
    } finally {
      setIsSavingCollection(false);
    }
  }, [newCollectionName, user?.id]);

  const styles = useMemo(() => createStyles(theme, isTablet), [theme, isTablet]);

  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.backdropBlobA} />
        <View style={styles.backdropBlobB} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading saved work...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 28 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Favorites</Text>
          <Text style={styles.subtitle}>Your favorite designs and saved collections</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Favorites</Text>
            {favoriteDesigns.length > 0 ? (
              <Text style={styles.sectionMeta}>
                {favoriteDesigns.length} saved {favoriteDesigns.length === 1 ? 'design' : 'designs'}
              </Text>
            ) : null}
          </View>

          {favoriteDesigns.length === 0 ? (
            <EmptyStateCard
              icon="HeartStraight"
              title="No favorites yet"
              body="Tap the heart on any design to keep your best ideas close."
              styles={styles}
              theme={theme}
            />
          ) : (
            favoriteRows.map((row, rowIndex) => (
              <View
                key={`favorite-row-${rowIndex}`}
                style={[styles.designRow, rowIndex > 0 && styles.designRowSpaced]}
              >
                {row.map((design, itemIndex) => (
                  <DesignCard
                    key={design.id}
                    design={design}
                    itemSize={itemSize}
                    onPress={() => onDesignSelect(design, favoriteDesigns, rowIndex * numColumns + itemIndex)}
                    theme={theme}
                    styles={styles}
                  />
                ))}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collections</Text>
            <AppButton
              variant="secondary"
              size="sm"
              icon="Plus"
              iconWeight="bold"
              title="New"
              onPress={handleStartCollection}
              style={styles.createCollectionButton}
            />
          </View>

          {isCreatingCollection ? (
            <View style={styles.createCollectionCard}>
              <View style={styles.createCollectionHeader}>
                <View>
                  <Text style={styles.createCollectionTitle}>New collection</Text>
                  <Text style={styles.createCollectionSubtitle}>Group favorite designs into sets.</Text>
                </View>
                <AppButton
                  variant="icon"
                  size="sm"
                  icon="X"
                  disabled={isSavingCollection}
                  onPress={handleCancelCollection}
                  accessibilityLabel="Cancel collection creation"
                />
              </View>

              <TextInput
                style={styles.createCollectionInput}
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                placeholder="Collection name"
                placeholderTextColor={theme.colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleCreateCollection}
                editable={!isSavingCollection}
                accessibilityLabel="Collection name"
              />

              <View style={styles.createCollectionActions}>
                <AppButton
                  variant="ghost"
                  size="sm"
                  title="Cancel"
                  disabled={isSavingCollection}
                  onPress={handleCancelCollection}
                />

                <AppButton
                  variant="primary"
                  size="sm"
                  title="Create"
                  loading={isSavingCollection}
                  onPress={handleCreateCollection}
                />
              </View>
            </View>
          ) : null}

          {collections.length === 0 ? (
            <EmptyStateCard
              icon="Folders"
              title="No collections yet"
              body="Create a collection to organize your saved design ideas."
              styles={styles}
              theme={theme}
            />
          ) : (
            collectionSummaries.map((summary) => {
              const collectionRows = chunkDesigns(summary.designs, numColumns);

              return (
                <View
                  key={summary.collection.id}
                  style={styles.collectionSection}
                >
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{summary.collection.name}</Text>
                    <Text style={styles.sectionMeta}>
                      {summary.designs.length} item{summary.designs.length === 1 ? '' : 's'}
                    </Text>
                  </View>

                  {summary.designs.length === 0 ? (
                    <EmptyStateCard
                      icon="FolderOpen"
                      title="Collection is empty"
                      body="Add saved designs to this collection from the gallery or detail view."
                      styles={styles}
                      theme={theme}
                    />
                  ) : (
                    collectionRows.map((row, rowIndex) => (
                      <View
                        key={`${summary.collection.id}-row-${rowIndex}`}
                        style={[styles.designRow, rowIndex > 0 && styles.designRowSpaced]}
                      >
                        {row.map((design, itemIndex) => (
                          <DesignCard
                            key={design.id}
                            design={design}
                            itemSize={itemSize}
                            onPress={() =>
                              onDesignSelect(
                                design,
                                summary.designs,
                                rowIndex * numColumns + itemIndex
                              )
                            }
                            theme={theme}
                            styles={styles}
                          />
                        ))}
                      </View>
                    ))
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function EmptyStateCard({
  icon,
  title,
  body,
  styles,
  theme,
}: {
  icon: string;
  title: string;
  body: string;
  styles: ReturnType<typeof createStyles>;
  theme: any;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <AppIcon name={icon} size={20} color={theme.colors.primary} />
      </View>
      <Text style={styles.emptyCardTitle}>{title}</Text>
      <Text style={styles.emptyCardBody}>{body}</Text>
    </View>
  );
}

function chunkDesigns(designs: SavedDesign[], size: number) {
  const rows: SavedDesign[][] = [];
  for (let index = 0; index < designs.length; index += size) {
    rows.push(designs.slice(index, index + size));
  }
  return rows;
}

const createStyles = (theme: any, isTablet: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backdropBlobA: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: theme.isDark ? 'rgba(143,179,154,0.12)' : 'rgba(78,107,87,0.11)',
      top: -90,
      left: -60,
    },
    backdropBlobB: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: theme.isDark ? 'rgba(181,122,82,0.08)' : 'rgba(181,122,82,0.08)',
      bottom: -120,
      right: -80,
    },
    content: {
      flex: 1,
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
    header: {
      marginTop: 12,
      marginHorizontal: 16,
      marginBottom: 14,
    },
    title: {
      fontSize: 30,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'serif',
    },
    subtitle: {
      marginTop: 4,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    section: {
      marginTop: 22,
    },
    sectionHeader: {
      marginHorizontal: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionTitle: {
      fontSize: 21,
      fontWeight: '700',
      color: theme.colors.text,
    },
    sectionMeta: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    createCollectionButton: {
      minWidth: 92,
    },
    createCollectionCard: {
      marginHorizontal: 16,
      marginBottom: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 16,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.isDark ? 0.22 : 0.08,
      shadowRadius: 14,
      elevation: 4,
    },
    createCollectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    createCollectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
    },
    createCollectionSubtitle: {
      marginTop: 4,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    createCollectionInput: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      marginTop: 14,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.colors.text,
    },
    createCollectionActions: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    emptyCard: {
      marginHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingVertical: 22,
      paddingHorizontal: 18,
      alignItems: 'flex-start',
    },
    emptyIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? theme.colors.card : theme.colors.borderLight,
      marginBottom: 12,
    },
    emptyCardTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
    },
    emptyCardBody: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    collectionSection: {
      marginTop: 10,
    },
    designRow: {
      marginHorizontal: 16,
      flexDirection: 'row',
      gap: 12,
    },
    designRowSpaced: {
      marginTop: 4,
    },
    designItem: {
      marginBottom: 18,
    },
    designItemPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
    imageContainer: {
      position: 'relative',
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.isDark ? 0.32 : 0.14,
      shadowRadius: 12,
      elevation: 8,
    },
    designImage: {
      width: '100%',
      aspectRatio: 1,
    },
    favoriteBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    infoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.62)',
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    plantTypeText: {
      color: 'white',
      fontSize: isTablet ? 14 : 13,
      fontWeight: '600',
    },
    plantStyleText: {
      color: 'white',
      fontSize: isTablet ? 12 : 11,
      opacity: 0.9,
      marginTop: 2,
    },
    dateText: {
      marginTop: 8,
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

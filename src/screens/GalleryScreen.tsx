import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  Modal,
  Platform,
  useWindowDimensions,
  Pressable,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { Collection, SavedDesign } from '../types';
import { databaseService } from '../services/databaseService';
import { useTabBar } from '../contexts/TabBarContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { UsageIndicator } from '../components/UsageIndicator';
import { CollectionPickerModal } from '../components/CollectionPickerModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { requestPhotoSavePermission, saveDesignImageToDevice } from '../utils/imageSave';
import { AccountScreen } from './AccountScreen';
import { useLibraryDataVersion } from '../hooks/useLibraryDataVersion';

const GALLERY_HINTS_SEEN_KEY = '@planterior_gallery_hints_seen';

interface GalleryScreenProps {
  onNewDesign: () => void;
  onIdentifyPlant: () => void;
  onDesignSelect: (design: SavedDesign, designs: SavedDesign[], initialIndex: number) => void;
  onUpgradePress?: () => void;
}

interface DesignCardProps {
  design: SavedDesign;
  index: number;
  itemSize: number;
  isSelected: boolean;
  isSelectionMode: boolean;
  styles: any;
  theme: any;
  onPress: (design: SavedDesign, index: number) => void;
  onLongPress: (designId: string) => void;
  onToggleFavorite: (design: SavedDesign) => void;
  onToggleSelection: (designId: string) => void;
}

type GalleryListItem =
  | {
      type: 'section';
      key: string;
      title: string;
    }
  | {
      type: 'row';
      key: string;
      items: SavedDesign[];
      indexes: number[];
    };

const getImageUri = (design: SavedDesign) => design.localImagePath || design.generatedImageUri;

const formatSectionDate = (date: Date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dateKey = date.toDateString();
  if (dateKey === today.toDateString()) return 'Today';
  if (dateKey === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
};

const getDayKey = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();

const DesignCard = React.memo(({
  design,
  index,
  itemSize,
  isSelected,
  isSelectionMode,
  styles,
  theme,
  onPress,
  onLongPress,
  onToggleFavorite,
  onToggleSelection,
}: DesignCardProps) => {
  const isSinglePlantDesign =
    (design.mode === 'individual' || design.mode === 'replace-plant') && design.individualPlant;

  return (
    <TouchableOpacity
      style={[styles.designItem, { width: itemSize }, isSelected && styles.designItemSelected]}
      onPress={() => onPress(design, index)}
      onLongPress={() => onLongPress(design.id)}
      delayLongPress={450}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${isSelected ? 'Selected' : 'Design'} ${isSinglePlantDesign ? design.individualPlant!.name : design.plantType?.name || 'Custom'}`}
      accessibilityHint={isSelectionMode ? 'Toggles selection' : 'Opens design details'}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: getImageUri(design) }}
          style={styles.designImage}
          resizeMode="cover"
        />

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => {
            if (isSelectionMode) {
              onToggleSelection(design.id);
              return;
            }
            onToggleFavorite(design);
          }}
        >
          <AppIcon
            name="Heart"
            size={18}
            color={design.isFavorite ? '#dc2626' : 'white'}
            weight={design.isFavorite ? 'fill' : 'regular'}
          />
        </TouchableOpacity>

        {isSelected && <View style={styles.selectedImageOverlay} />}

        {isSelectionMode && (
          <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeSelected]}>
            <AppIcon
              name={isSelected ? 'Check' : 'Circle'}
              size={18}
              color={isSelected ? theme.colors.surface : 'white'}
              weight={isSelected ? 'bold' : 'regular'}
            />
          </View>
        )}

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
    </TouchableOpacity>
  );
});

export const GalleryScreen: React.FC<GalleryScreenProps> = ({
  onNewDesign,
  onIdentifyPlant,
  onDesignSelect,
  onUpgradePress,
}) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [collectionTargetIds, setCollectionTargetIds] = useState<string[]>([]);
  const [selectedDesignIds, setSelectedDesignIds] = useState<Set<string>>(new Set());
  const [showGalleryHints, setShowGalleryHints] = useState(false);
  const [isAccountSheetMounted, setIsAccountSheetMounted] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { handleScroll, tabBarHeight } = useTabBar();
  const { theme } = useTheme();
  const { subscription, freeGenerationsRemaining, refreshStatus } = useSubscription();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { width, height } = useWindowDimensions();
  const accountSheetProgress = useRef(new Animated.Value(0)).current;
  const libraryDataVersion = useLibraryDataVersion();

  const isTablet = Platform.OS === 'ios' && Math.min(width, height) >= 768;
  const numColumns = isTablet ? (width >= 1180 ? 4 : 3) : 2;
  const listHorizontalPadding = isTablet ? 24 : 16;
  const interItemGap = isTablet ? 14 : 12;
  const itemSize = Math.floor(
    (width - listHorizontalPadding * 2 - interItemGap * (numColumns - 1)) / numColumns
  );

  const loadDesigns = useCallback(async () => {
    try {
      const savedDesigns = await databaseService.getAllDesigns(user?.id);
      setDesigns(savedDesigns);
    } catch (error) {
      console.error('Failed to load designs:', error);
      Alert.alert('Error', 'Failed to load your designs');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadCollections = useCallback(async () => {
    try {
      const result = await databaseService.getCollections(user?.id);
      setCollections(result);
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDesigns(), loadCollections(), refreshStatus()]);
    setRefreshing(false);
  }, [loadDesigns, loadCollections, refreshStatus]);

  useEffect(() => {
    loadDesigns();
    loadCollections();
  }, [loadDesigns, loadCollections, libraryDataVersion]);

  const selectedCount = selectedDesignIds.size;
  const isSelectionMode = selectedCount > 0;
  const selectedDesigns = designs.filter((d) => selectedDesignIds.has(d.id));
  const accountSheetWidth = Math.min(width - 12, isTablet ? 430 : width * 0.88);
  const accountSheetTranslateX = accountSheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [accountSheetWidth, 0],
  });
  const accountSheetBackdropOpacity = accountSheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleDesignPress = (design: SavedDesign, index: number) => {
    if (isSelectionMode) {
      toggleDesignSelection(design.id);
      return;
    }
    onDesignSelect(design, designs, index);
  };

  const dismissGalleryHints = useCallback(async () => {
    setShowGalleryHints(false);
    try {
      await AsyncStorage.setItem(GALLERY_HINTS_SEEN_KEY, 'true');
    } catch (error) {
      console.error('Failed to store gallery hints status:', error);
    }
  }, []);

  useEffect(() => {
    const loadGalleryHintsStatus = async () => {
      try {
        const value = await AsyncStorage.getItem(GALLERY_HINTS_SEEN_KEY);
        setShowGalleryHints(value !== 'true');
      } catch (error) {
        console.error('Failed to read gallery hints status:', error);
      }
    };

    loadGalleryHintsStatus();
  }, []);

  useEffect(() => {
    if (!isAccountSheetMounted) {
      return;
    }

    Animated.spring(accountSheetProgress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 24,
      stiffness: 260,
      mass: 0.9,
    }).start();
  }, [accountSheetProgress, isAccountSheetMounted]);

  const toggleDesignSelection = (designId: string) => {
    setSelectedDesignIds((prev) => {
      const next = new Set(prev);
      if (next.has(designId)) {
        next.delete(designId);
      } else {
        next.add(designId);
      }
      return next;
    });
  };

  const enterSelectionMode = (designId: string) => {
    setSelectedDesignIds(new Set([designId]));
    if (showGalleryHints) {
      dismissGalleryHints();
    }
  };

  const startNewDesign = () => {
    if (showGalleryHints) {
      dismissGalleryHints();
    }
    onNewDesign();
  };

  const startPlantIdentification = () => {
    if (showGalleryHints) {
      dismissGalleryHints();
    }
    onIdentifyPlant();
  };

  const openAccountSheet = useCallback(() => {
    if (showGalleryHints) {
      dismissGalleryHints();
    }
    setIsAccountSheetMounted(true);
  }, [dismissGalleryHints, showGalleryHints]);

  const closeAccountSheet = useCallback(() => {
    Animated.timing(accountSheetProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setIsAccountSheetMounted(false);
    });
  }, [accountSheetProgress]);

  const clearSelection = () => {
    setSelectedDesignIds(new Set());
    setCollectionTargetIds([]);
  };

  const openSelectedCollectionPicker = () => {
    if (selectedCount === 0) return;
    setCollectionTargetIds(Array.from(selectedDesignIds));
    setShowCollectionsModal(true);
  };

  const deleteSelectedDesigns = () => {
    if (selectedCount === 0) return;

    Alert.alert(
      selectedCount === 1 ? 'Delete Design' : `Delete ${selectedCount} Designs`,
      selectedCount === 1
        ? 'Are you sure you want to delete this design? This action cannot be undone.'
        : 'Are you sure you want to delete these designs? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const idsToDelete = Array.from(selectedDesignIds);
              await Promise.all(idsToDelete.map((id) => databaseService.deleteDesign(id)));
              setDesigns((prev) => prev.filter((design) => !selectedDesignIds.has(design.id)));
              clearSelection();
              showToast(
                idsToDelete.length === 1 ? 'Design deleted' : `${idsToDelete.length} designs deleted`,
                'success'
              );
            } catch (error) {
              console.error('Failed to delete selected designs:', error);
              showToast('Could not delete selected designs', 'error');
            }
          },
        },
      ]
    );
  };

  const saveSelectedDesignsToDevice = async () => {
    if (selectedDesigns.length === 0 || isBatchSaving) return;

    setIsBatchSaving(true);
    try {
      const hasPermission = await requestPhotoSavePermission();
      if (!hasPermission) return;

      await Promise.all(
        selectedDesigns.map((selectedDesign) =>
          saveDesignImageToDevice(selectedDesign, { requestPermission: false })
        )
      );
      showToast(
        selectedDesigns.length === 1
          ? 'Saved to Photos'
          : `Saved ${selectedDesigns.length} images to Photos`,
        'success'
      );
    } catch (error) {
      console.error('Failed to save selected designs:', error);
      showToast('Could not save selected images', 'error');
    } finally {
      setIsBatchSaving(false);
    }
  };

  const toggleFavorite = useCallback(async (design: SavedDesign) => {
    try {
      await databaseService.toggleFavorite(design.id);
      const nextFavorite = !design.isFavorite;
      // Update local state
      setDesigns(prev =>
        prev.map(d =>
          d.id === design.id
            ? { ...d, isFavorite: nextFavorite }
            : d
        )
      );
      showToast(nextFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      showToast('Could not update favorite', 'error');
    }
  }, [showToast]);

  const styles = useMemo(
    () => createStyles(theme, isTablet, listHorizontalPadding, interItemGap),
    [theme, isTablet, listHorizontalPadding, interItemGap]
  );

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconRing}>
        <AppIcon name="Leaf" size={40} color={theme.colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No designs yet</Text>
      <Text style={styles.emptyText}>
        Snap a photo of your room and let AI add the perfect plants
      </Text>
      <TouchableOpacity style={styles.emptyCreateButton} onPress={startNewDesign}>
        <AppIcon name="Plus" size={18} color="white" />
        <Text style={styles.emptyCreateText}>Start With A Photo</Text>
      </TouchableOpacity>
    </View>
  ), [startNewDesign, styles, theme.colors.primary]);

  const listContentStyle = useMemo(() => [
    styles.listContainer,
    { paddingBottom: tabBarHeight + 20 },
  ], [styles, tabBarHeight]);

  const galleryItems = useMemo<GalleryListItem[]>(() => {
    const grouped = new Map<string, { date: Date; items: SavedDesign[]; indexes: number[] }>();

    designs.forEach((design, index) => {
      const key = getDayKey(design.createdAt);
      const existing = grouped.get(key);
      if (existing) {
        existing.items.push(design);
        existing.indexes.push(index);
        return;
      }
      grouped.set(key, {
        date: design.createdAt,
        items: [design],
        indexes: [index],
      });
    });

    return Array.from(grouped.entries()).flatMap(([key, value]) => {
      const rows: GalleryListItem[] = [
        {
          type: 'section',
          key: `section-${key}`,
          title: formatSectionDate(value.date),
        },
      ];

      for (let i = 0; i < value.items.length; i += numColumns) {
        rows.push({
          type: 'row',
          key: `row-${key}-${i}`,
          items: value.items.slice(i, i + numColumns),
          indexes: value.indexes.slice(i, i + numColumns),
        });
      }

      return rows;
    });
  }, [designs, numColumns]);

  const renderGalleryItem = useCallback(({ item }: { item: GalleryListItem }) => {
    if (item.type === 'section') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      );
    }

    return (
      <View style={styles.row}>
        {item.items.map((design, rowIndex) => (
          <DesignCard
            key={design.id}
            design={design}
            index={item.indexes[rowIndex]}
            itemSize={itemSize}
            isSelected={selectedDesignIds.has(design.id)}
            isSelectionMode={isSelectionMode}
            styles={styles}
            theme={theme}
            onPress={handleDesignPress}
            onLongPress={enterSelectionMode}
            onToggleFavorite={toggleFavorite}
            onToggleSelection={toggleDesignSelection}
          />
        ))}
        {item.items.length < numColumns &&
          Array.from({ length: numColumns - item.items.length }).map((_, fillerIndex) => (
            <View key={`filler-${item.key}-${fillerIndex}`} style={{ width: itemSize }} />
          ))}
      </View>
    );
  }, [
    enterSelectionMode,
    handleDesignPress,
    isSelectionMode,
    itemSize,
    numColumns,
    selectedDesignIds,
    styles,
    theme,
    toggleFavorite,
  ]);

  const galleryKeyExtractor = useCallback((item: GalleryListItem) => item.key, []);

  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
        <View style={styles.backdropBlobA} />
        <View style={styles.backdropBlobB} />

        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your images...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container}>
      <View style={styles.backdropBlobA} />
      <View style={styles.backdropBlobB} />

      {isSelectionMode && <View style={styles.selectionFloatingButtonOffset} />}

      {isSelectionMode ? (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity
            onPress={clearSelection}
            style={styles.selectionCancelButton}
            accessibilityLabel="Cancel selection"
          >
            <AppIcon name="X" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>
            {selectedCount} selected
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity
              onPress={openSelectedCollectionPicker}
              style={styles.selectionActionButton}
              accessibilityLabel="Add selected designs to collection"
            >
              <AppIcon name="FolderPlus" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveSelectedDesignsToDevice}
              style={styles.selectionActionButton}
              disabled={isBatchSaving}
              accessibilityLabel="Save selected designs to device"
            >
              <AppIcon
                name={isBatchSaving ? 'Hourglass' : 'DownloadSimple'}
                size={24}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={deleteSelectedDesigns}
              style={[styles.selectionActionButton, styles.selectionDeleteButton]}
              accessibilityLabel="Delete selected designs"
            >
              <AppIcon name="Trash" size={24} color="#dc2626" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.topBar}>
            <View style={styles.topBarCopy}>
              <Text style={styles.topBarTitle}>Gallery</Text>
              <Text style={styles.topBarSubtitle}>
                {designs.length === 0
                  ? 'Your saved room previews will show up here'
                  : `${designs.length} saved ${designs.length === 1 ? 'design' : 'designs'}`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={openAccountSheet}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open account"
              accessibilityHint="Show account and subscription options"
              style={styles.accountButton}
            >
              {user?.picture ? (
                <Image source={{ uri: user.picture }} style={styles.accountAvatarImage} />
              ) : (
                <View style={styles.accountAvatarFallback}>
                  <AppIcon
                    name={user?.provider === 'apple' ? 'AppleLogo' : 'GoogleLogo'}
                    size={20}
                    color={theme.colors.text}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {showGalleryHints && (
            <View style={styles.galleryHints}>
              <View style={styles.galleryHintRow}>
                <AppIcon name="Plus" size={16} color={theme.colors.primary} />
                <Text style={styles.galleryHintText}>
                  Use the plus button above the tabs for a new room photo, or the search button beside it to identify a plant
                </Text>
              </View>
              <View style={styles.galleryHintRow}>
                <AppIcon name="CursorClick" size={16} color={theme.colors.primary} />
                <Text style={styles.galleryHintText}>Long-press images to select</Text>
              </View>
              <TouchableOpacity
                onPress={dismissGalleryHints}
                style={styles.galleryHintDismiss}
                accessibilityLabel="Dismiss gallery tips"
              >
                <Text style={styles.galleryHintDismissText}>Got it</Text>
              </TouchableOpacity>
            </View>
          )}

          <UsageIndicator
            freeRemaining={freeGenerationsRemaining}
            isSubscribed={subscription?.isActive || false}
            variant="full"
            onUpgradePress={onUpgradePress}
          />
        </>
      )}

      <FlatList
        key={`gallery-${numColumns}`}
        data={galleryItems}
        renderItem={renderGalleryItem}
        keyExtractor={galleryKeyExtractor}
        contentContainerStyle={listContentStyle}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={7}
        initialNumToRender={Math.max(8, numColumns * 4)}
        updateCellsBatchingPeriod={50}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {!isSelectionMode && (
        <View pointerEvents="box-none" style={styles.floatingActionLayer}>
          <TouchableOpacity
            onPress={startPlantIdentification}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Identify plant"
            accessibilityHint="Open plant identification"
            style={[styles.secondaryFloatingButton, { bottom: tabBarHeight + 26 }]}
          >
            <AppIcon name="MagnifyingGlass" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <CollectionPickerModal
        visible={showCollectionsModal}
        collections={collections}
        selectedCollectionId={
          collectionTargetIds.length === 1
            ? designs.find((d) => d.id === collectionTargetIds[0])?.collectionId ?? null
            : null
        }
        title={collectionTargetIds.length > 0 ? 'Add to Collection' : 'Collections'}
        allowNone
        noneLabel={collectionTargetIds.length > 0 ? 'No Collection' : 'All Collections'}
        noneIcon={collectionTargetIds.length > 0 ? 'Prohibit' : 'GridFour'}
        onDismiss={() => {
          setShowCollectionsModal(false);
          setCollectionTargetIds([]);
        }}
        onCreate={async (name) => {
          const targetIds = [...collectionTargetIds];
          try {
            const created = await databaseService.createCollection(name, user?.id);
            setCollections((prev) => [created, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
            if (targetIds.length > 0) {
              await Promise.all(targetIds.map((id) => databaseService.setDesignCollection(id, created.id)));
              setDesigns((prev) =>
                prev.map((d) => (targetIds.includes(d.id) ? { ...d, collectionId: created.id } : d))
              );
              setShowCollectionsModal(false);
              clearSelection();
              showToast(
                targetIds.length === 1
                  ? `Added to ${created.name}`
                  : `Added ${targetIds.length} designs to ${created.name}`,
                'success'
              );
            } else {
              setShowCollectionsModal(false);
              showToast(`Created ${created.name}`, 'success');
            }
          } catch (error) {
            console.error('Failed to create collection:', error);
            showToast('Could not create collection', 'error');
          }
        }}
        onSelect={async (collectionId) => {
          const targetIds = [...collectionTargetIds];
          try {
            if (targetIds.length === 0) {
              setShowCollectionsModal(false);
              return;
            }
            await Promise.all(targetIds.map((id) => databaseService.setDesignCollection(id, collectionId)));
            const selectedCollection = collections.find((c) => c.id === collectionId);
            setDesigns((prev) =>
              prev.map((d) => (targetIds.includes(d.id) ? { ...d, collectionId } : d))
            );
            setShowCollectionsModal(false);
            const movedCount = targetIds.length;
            clearSelection();
            showToast(
              collectionId
                ? movedCount === 1
                  ? `Moved to ${selectedCollection?.name || 'collection'}`
                  : `Moved ${movedCount} designs to ${selectedCollection?.name || 'collection'}`
                : movedCount === 1
                  ? 'Removed from collection'
                  : `Removed ${movedCount} designs from collection`,
              'success'
            );
          } catch (error) {
            console.error('Failed to set collection:', error);
            showToast('Could not update collection', 'error');
          }
        }}
      />

      <Modal
        visible={isAccountSheetMounted}
        transparent
        animationType="none"
        onRequestClose={closeAccountSheet}
      >
        <View style={styles.accountSheetModal}>
          <Animated.View
            style={[
              styles.accountSheetBackdrop,
              { opacity: accountSheetBackdropOpacity },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeAccountSheet} />
          </Animated.View>

          <Animated.View
            style={[
              styles.accountSheetPanel,
              {
                width: accountSheetWidth,
                transform: [{ translateX: accountSheetTranslateX }],
              },
            ]}
          >
            <AccountScreen
              presentation="sheet"
              onClose={closeAccountSheet}
              onUpgradePress={onUpgradePress}
            />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (
  theme: any,
  isTablet: boolean,
  listHorizontalPadding: number,
  interItemGap: number
) => StyleSheet.create({
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
  selectionFloatingButtonOffset: {
    height: 62,
  },
  selectionToolbar: {
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.isDark ? 'rgba(143,179,154,0.55)' : 'rgba(47,122,82,0.28)',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.38 : 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  selectionCancelButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#eef2f1',
  },
  selectionTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionActionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc',
  },
  selectionDeleteButton: {
    borderColor: theme.isDark ? 'rgba(220,38,38,0.4)' : '#fecaca',
    backgroundColor: theme.isDark ? 'rgba(220,38,38,0.1)' : '#fff1f2',
  },
  galleryHints: {
    marginTop: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 8,
  },
  galleryHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  galleryHintText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  galleryHintDismiss: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  galleryHintDismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  placeholder: {
    width: 40,
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
  topBar: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topBarCopy: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: theme.colors.text,
    fontFamily: 'serif',
  },
  topBarSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  accountButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: theme.isDark ? 0.28 : 0.12,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  accountAvatarImage: {
    width: '100%',
    height: '100%',
  },
  accountAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : '#f6f7f5',
  },
  listContainer: {
    paddingHorizontal: listHorizontalPadding,
    paddingTop: 12,
    flexGrow: 1,
  },
  row: {
    gap: interItemGap,
    justifyContent: 'flex-start',
    flexDirection: 'row',
    marginBottom: 24,
  },
  sectionHeader: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  designItem: {
    marginBottom: 0,
  },
  designItemSelected: {
    transform: [{ scale: 0.985 }],
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
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 17,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  selectionBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 2,
  },
  selectionBadgeSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  selectedImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: theme.colors.primary,
    backgroundColor: theme.isDark ? 'rgba(47,122,82,0.18)' : 'rgba(47,122,82,0.12)',
    zIndex: 1,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    zIndex: 2,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.isDark ? theme.colors.surface : '#f0fdf4',
    borderWidth: 2,
    borderColor: theme.isDark ? theme.colors.border : '#bbf7d0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 24,
    marginBottom: 10,
    fontFamily: 'serif',
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 270,
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyCreateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  floatingActionLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  accountSheetModal: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  accountSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,12,0.28)',
  },
  accountSheetPanel: {
    flex: 1,
    maxWidth: 430,
    backgroundColor: theme.colors.background,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: theme.isDark ? 0.35 : 0.14,
    shadowRadius: 20,
    elevation: 16,
  },
  secondaryFloatingButton: {
    position: 'absolute',
    right: 108,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.isDark ? 0.34 : 0.16,
    shadowRadius: 14,
    elevation: 10,
  },
});

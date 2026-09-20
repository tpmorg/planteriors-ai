import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import { PlantCatalogCard } from '../components/PlantCatalogCard';
import { ScrollMoreCue, useScrollOverflow } from '../components/ScrollMoreCue';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { INDIVIDUAL_PLANTS } from '../data/plantDatabase';
import { selectPlant, toIndividualPlant } from '../designFlow/designFlow';
import { databaseService } from '../services/databaseService';
import type { IndividualPlant, IndividualPlantSelection, PlantSearchResult } from '../types';

export function PlantChooserScreen({ backgroundImageUri, onSelect, onBack, onClose, onIdentify }: {
  backgroundImageUri?: string;
  onSelect: (selection: IndividualPlantSelection) => void;
  onBack: () => void;
  onClose: () => void;
  onIdentify: () => void;
}) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const styles = createStyles(theme);
  const [source, setSource] = useState<'browse' | 'mine'>('browse');
  const [query, setQuery] = useState('');
  const [petSafeOnly, setPetSafeOnly] = useState(false);
  const [savedPlants, setSavedPlants] = useState<IndividualPlant[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const listRef = useRef<FlatList<IndividualPlant>>(null);
  const overflow = useScrollOverflow();

  useEffect(() => { listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [source, query, petSafeOnly]);

  const loadSaved = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const rows = await databaseService.getUserAddedPlants();
      setSavedPlants(rows.flatMap((row: PlantSearchResult) => {
        const mapped = toIndividualPlant(row);
        if (mapped) return [mapped];
        const catalogMatch = INDIVIDUAL_PLANTS.find((plant) =>
          plant.scientificName.toLowerCase() === row.scientificName?.toLowerCase() ||
          plant.name.toLowerCase() === row.name?.toLowerCase()
        );
        return catalogMatch ? [catalogMatch] : [];
      }));
    } catch (error) {
      console.error('Failed to load My plants:', error);
      showToast('My plants could not be loaded.', 'error');
    } finally {
      setLoadingSaved(false);
    }
  }, [showToast]);

  useEffect(() => { if (source === 'mine') void loadSaved(); }, [loadSaved, source]);

  useSpeechRecognitionEvent('start', () => setVoiceBusy(true));
  useSpeechRecognitionEvent('end', () => setVoiceBusy(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (transcript) setQuery(transcript);
  });
  useSpeechRecognitionEvent('error', () => {
    setVoiceBusy(false);
    showToast('Voice search is unavailable right now.', 'error');
  });

  const startVoiceSearch = async () => {
    if (voiceBusy) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        showToast('Allow microphone access to search by voice.', 'error');
        return;
      }
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, continuous: false });
    } catch (error) {
      console.error('Failed to start voice search:', error);
      showToast('Voice search is unavailable right now.', 'error');
    }
  };

  const filtered = useMemo(() => {
    const sourcePlants = source === 'browse' ? [...INDIVIDUAL_PLANTS].sort((a, b) => a.name.localeCompare(b.name)) : savedPlants;
    const normalized = query.trim().toLowerCase();
    return sourcePlants.filter((plant) =>
      (!petSafeOnly || plant.petSafe) &&
      (!normalized || plant.name.toLowerCase().includes(normalized) || plant.scientificName.toLowerCase().includes(normalized))
    );
  }, [petSafeOnly, query, savedPlants, source]);

  return (
    <View style={styles.container}>
      {backgroundImageUri ? <Image source={{ uri: backgroundImageUri }} style={styles.roomImage} resizeMode="cover" /> : null}
      <View style={styles.scrim} />
      <SafeAreaView edges={['top', 'right', 'left']} style={styles.safeArea}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <AppButton variant="icon" icon="ArrowLeft" onPress={onBack} accessibilityLabel="Back" />
            <View style={styles.heading}>
              <Text style={styles.title}>Add a plant</Text>
              <Text style={styles.subtitle}>{filtered.length} {filtered.length === 1 ? 'option' : 'options'}</Text>
            </View>
            <AppButton variant="icon" icon="X" onPress={onClose} accessibilityLabel="Close" />
          </View>
          <View style={styles.controls}>
            <View style={styles.sourceTabs}>
              {(['browse', 'mine'] as const).map((value) => (
                <AppButton
                  key={value}
                  variant="chip"
                  size="sm"
                  selected={source === value}
                  title={value === 'browse' ? 'Browse' : 'My plants'}
                  textStyle={styles.sourceText}
                  onPress={() => setSource(value)}
                  style={styles.sourceTab}
                />
              ))}
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}><AppIcon name="MagnifyingGlass" size={17} color={theme.colors.textSecondary} /><TextInput value={query} onChangeText={setQuery} placeholder="Search plants" placeholderTextColor={theme.colors.textSecondary} style={styles.input} /><AppButton variant="icon" size="sm" icon="Microphone" iconColor={voiceBusy ? theme.colors.primary : theme.colors.textSecondary} onPress={startVoiceSearch} accessibilityLabel="Search by voice" /></View>
            </View>
            <View style={styles.filterRow}><View><Text style={styles.filterTitle}>Pet-safe only</Text><Text style={styles.filterNote}>Catalog guidance, not a guarantee</Text></View><Switch value={petSafeOnly} onValueChange={setPetSafeOnly} /></View>
          </View>
          <FlatList
            ref={listRef}
            onLayout={overflow.onLayout}
            onContentSizeChange={overflow.onContentSizeChange}
            onScroll={overflow.onScroll}
            scrollEventThrottle={32}
            keyboardDismissMode="on-drag"
            data={loadingSaved ? [] : filtered}
            keyExtractor={(plant) => plant.id}
            style={styles.results}
            contentContainerStyle={[styles.plantGrid, (loadingSaved || filtered.length === 0) && styles.emptyResults]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
            renderItem={({ item: plant }) => (
              <PlantCatalogCard
                plant={plant}
                imageSource={plant.imageUrl}
                onPress={() => onSelect(selectPlant(plant))}
                accessibilityLabel={`Choose ${plant.name}`}
                metadata={[plant.availableSizes.join(' • '), ...(plant.petSafe ? ['Pet safe'] : [])]}
              />
            )}
            ListEmptyComponent={loadingSaved ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <View style={styles.empty}><Text style={styles.emptyTitle}>{source === 'mine' ? 'No saved plants yet' : 'No matching plants'}</Text><Text style={styles.emptyText}>{source === 'mine' ? 'Identify a plant or browse the catalog.' : 'Edit your search or clear the pet-safe filter.'}</Text><View style={styles.emptyActions}><AppButton variant="secondary" size="sm" title="Browse plants" onPress={() => { setSource('browse'); setQuery(''); }} />{source === 'mine' ? <AppButton variant="primary" size="sm" title="Identify a plant" onPress={onIdentify} /> : null}</View></View>
            )}
          />
          <ScrollMoreCue visible={overflow.hasMoreBelow} onPress={() => listRef.current?.scrollToOffset({ offset: overflow.nextOffset(), animated: true })} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  roomImage: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.scrim },
  safeArea: { flex: 1, justifyContent: 'flex-end' },
  sheet: { height: '91%', overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: theme.colors.background, borderWidth: 1, borderBottomWidth: 0, borderColor: theme.colors.border },
  handle: { width: 42, height: 5, borderRadius: 999, alignSelf: 'center', marginTop: 9, backgroundColor: theme.colors.border },
  header: { minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { flex: 1, alignItems: 'center' },
  title: { color: theme.colors.text, fontSize: 19, fontWeight: '800' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 1 },
  controls: { paddingHorizontal: 16 },
  sourceTabs: { flexDirection: 'row', padding: 3, borderRadius: 13, backgroundColor: theme.colors.borderLight },
  sourceTab: { flex: 1, borderRadius: 11 },
  sourceText: { fontSize: 13 },
  searchRow: { marginTop: 9 }, searchBox: { height: 44, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, input: { flex: 1, color: theme.colors.text, fontSize: 14 },
  filterRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filterTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700' }, filterNote: { color: theme.colors.textSecondary, fontSize: 10, marginTop: 1 },
  results: { flex: 1, paddingHorizontal: 16 },
  plantGrid: { paddingTop: 4, paddingBottom: 36 },
  listSeparator: { height: 10 },
  emptyResults: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 24 }, emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' }, emptyText: { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 7, lineHeight: 19 }, emptyActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});

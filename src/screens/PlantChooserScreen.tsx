import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { AppIcon } from '../components/AppIcon';
import { DesignFlowShell } from '../components/DesignFlowShell';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { INDIVIDUAL_PLANTS } from '../data/plantDatabase';
import { selectPlant, toIndividualPlant } from '../designFlow/designFlow';
import { databaseService } from '../services/databaseService';
import type { IndividualPlant, IndividualPlantSelection, PlantSearchResult } from '../types';

const PAGE_SIZE = 3;

export function PlantChooserScreen({ onSelect, onBack, onClose, onIdentify }: {
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
  const [page, setPage] = useState(0);
  const [savedPlants, setSavedPlants] = useState<IndividualPlant[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);

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
  useEffect(() => { setPage(0); }, [source, query, petSafeOnly]);

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
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <DesignFlowShell title="Choose a plant" subtitle={`${filtered.length} ${filtered.length === 1 ? 'plant' : 'plants'}`} onBack={onBack} onClose={onClose}>
      <View style={styles.sourceTabs}>
        {(['browse', 'mine'] as const).map((value) => (
          <TouchableOpacity key={value} style={[styles.sourceTab, source === value && styles.sourceTabActive]} onPress={() => setSource(value)}>
            <Text style={[styles.sourceText, source === value && styles.sourceTextActive]}>{value === 'browse' ? 'Browse' : 'My plants'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}><AppIcon name="MagnifyingGlass" size={18} color={theme.colors.textSecondary} /><TextInput value={query} onChangeText={setQuery} placeholder="Search plants" placeholderTextColor={theme.colors.textSecondary} style={styles.input} /><TouchableOpacity onPress={startVoiceSearch} accessibilityLabel="Search by voice"><AppIcon name="Microphone" size={18} color={voiceBusy ? theme.colors.primary : theme.colors.textSecondary} /></TouchableOpacity></View>
      </View>
      <View style={styles.filterRow}><View><Text style={styles.filterTitle}>Pet-safe only</Text><Text style={styles.filterNote}>Catalog information, not a guarantee</Text></View><Switch value={petSafeOnly} onValueChange={setPetSafeOnly} /></View>
      <View style={styles.results}>
        {loadingSaved ? <ActivityIndicator color={theme.colors.primary} /> : visible.map((plant) => (
          <TouchableOpacity key={plant.id} style={styles.plantCard} onPress={() => onSelect(selectPlant(plant))} accessibilityRole="button">
            {plant.imageUrl ? <Image source={plant.imageUrl} style={styles.plantImage as any} /> : <View style={styles.plantIcon}><AppIcon name={plant.icon || 'Leaf'} size={28} color={theme.colors.primary} /></View>}
            <View style={styles.plantCopy}><Text style={styles.plantName}>{plant.name}</Text><Text style={styles.scientific} numberOfLines={1}>{plant.scientificName}</Text><Text style={styles.meta}>{plant.availableSizes.join(' • ')}{plant.petSafe ? ' • Pet safe' : ''}</Text></View>
            <AppIcon name="ArrowRight" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ))}
        {!loadingSaved && filtered.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>{source === 'mine' ? 'No saved plants yet' : 'No matching plants'}</Text><Text style={styles.emptyText}>{source === 'mine' ? 'Identify a plant or browse the catalog.' : 'Edit your search or clear the pet-safe filter.'}</Text><View style={styles.emptyActions}><TouchableOpacity style={styles.emptyButton} onPress={() => { setSource('browse'); setQuery(''); }}><Text style={styles.emptyButtonText}>Browse plants</Text></TouchableOpacity>{source === 'mine' ? <TouchableOpacity style={styles.emptyButton} onPress={onIdentify}><Text style={styles.emptyButtonText}>Identify a plant</Text></TouchableOpacity> : null}</View></View>
        ) : null}
      </View>
      {filtered.length > PAGE_SIZE ? <View style={styles.pagination}><TouchableOpacity style={styles.pageButton} onPress={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><Text style={[styles.pageText, page === 0 && styles.disabled]}>Previous</Text></TouchableOpacity><Text style={styles.pageCount}>{page + 1} of {pageCount}</Text><TouchableOpacity style={styles.pageButton} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}><Text style={[styles.pageText, page >= pageCount - 1 && styles.disabled]}>Next</Text></TouchableOpacity></View> : null}
    </DesignFlowShell>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  sourceTabs: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: theme.colors.borderLight, marginTop: 8 },
  sourceTab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sourceTabActive: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  sourceText: { color: theme.colors.textSecondary, fontWeight: '700' }, sourceTextActive: { color: theme.colors.primary },
  searchRow: { marginTop: 12 }, searchBox: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 }, input: { flex: 1, color: theme.colors.text, fontSize: 15 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }, filterTitle: { color: theme.colors.text, fontWeight: '700' }, filterNote: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 2 },
  results: { flex: 1, gap: 10, justifyContent: 'center' },
  plantCard: { minHeight: 94, borderRadius: 17, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', padding: 12 },
  plantImage: { width: 66, height: 66, borderRadius: 13 }, plantIcon: { width: 66, height: 66, borderRadius: 13, backgroundColor: theme.colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  plantCopy: { flex: 1, marginHorizontal: 12 }, plantName: { color: theme.colors.text, fontSize: 16, fontWeight: '800' }, scientific: { color: theme.colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 2 }, meta: { color: theme.colors.primary, fontSize: 11, marginTop: 7, textTransform: 'capitalize' },
  empty: { alignItems: 'center', padding: 24 }, emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' }, emptyText: { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 7, lineHeight: 19 }, emptyActions: { flexDirection: 'row', gap: 10, marginTop: 16 }, emptyButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.border }, emptyButtonText: { color: theme.colors.primary, fontWeight: '700' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }, pageButton: { minWidth: 74, padding: 10 }, pageText: { color: theme.colors.primary, fontWeight: '700', textAlign: 'center' }, disabled: { opacity: 0.35 }, pageCount: { color: theme.colors.textSecondary, fontSize: 13 },
});

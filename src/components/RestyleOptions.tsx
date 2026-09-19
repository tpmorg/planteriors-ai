import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { MAINTENANCE_LEVELS, PLACEMENT_DENSITIES, PLANT_TYPES, POT_COLORS, POT_STYLES } from '../designFlow/designFlow';
import type { DesignFlowDraft, PlantOptions } from '../types';

type Choice = { id: string; name: string; hex?: string };

function RadioSection({ title, choices, selected, onSelect }: {
  title: string;
  choices: Choice[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
    <View style={styles.choices}>
      {choices.map((choice) => <TouchableOpacity key={choice.id} accessibilityRole="radio"
        accessibilityLabel={`${title}: ${choice.name}`} accessibilityState={{ checked: selected === choice.id }}
        onPress={() => onSelect(choice.id)} style={[styles.choice, selected === choice.id && styles.selected]}>
        <View style={[styles.radio, selected === choice.id && styles.radioSelected]}>
          {selected === choice.id ? <View style={styles.dot} /> : null}
        </View>
        {choice.hex ? <View style={[styles.swatch, { backgroundColor: choice.hex }]} /> : null}
        <Text style={styles.label}>{choice.name}</Text>
      </TouchableOpacity>)}
    </View>
  </View>;
}

export function RestyleOptions({ draft, updateDraft }: {
  draft: DesignFlowDraft;
  updateDraft: (patch: Partial<DesignFlowDraft>) => void;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const options = draft.plantOptions;
  const updateOptions = (patch: Partial<PlantOptions>) => {
    if (options) updateDraft({ plantOptions: { ...options, ...patch } });
  };
  return <View style={styles.container}>
    <RadioSection title="Plant type" choices={PLANT_TYPES} selected={draft.plantType?.id} onSelect={(id) => {
      const plantType = PLANT_TYPES.find((value) => value.id === id)!;
      const plantStyle = plantType.styles.find((value) => value.id === draft.plantStyle?.id) || plantType.styles[0];
      updateDraft({ plantType, plantStyle });
    }} />
    <RadioSection title="Style" choices={draft.plantType?.styles || []} selected={draft.plantStyle?.id}
      onSelect={(id) => updateDraft({ plantStyle: draft.plantType?.styles.find((value) => value.id === id) })} />
    <RadioSection title="Plant density" choices={PLACEMENT_DENSITIES} selected={options?.placementDensity.id}
      onSelect={(id) => updateOptions({ placementDensity: PLACEMENT_DENSITIES.find((value) => value.id === id)! })} />
    <RadioSection title="Care level" choices={MAINTENANCE_LEVELS} selected={options?.maintenanceLevel.id}
      onSelect={(id) => updateOptions({ maintenanceLevel: MAINTENANCE_LEVELS.find((value) => value.id === id)! })} />
    <RadioSection title="Pot style" choices={POT_STYLES} selected={options?.potStyle.id}
      onSelect={(id) => updateOptions({ potStyle: POT_STYLES.find((value) => value.id === id)! })} />
    <RadioSection title="Pot color" choices={POT_COLORS} selected={options?.potColor.id}
      onSelect={(id) => updateOptions({ potColor: POT_COLORS.find((value) => value.id === id)! })} />
    <RadioSection title="Planter boxes" choices={[{ id: 'no', name: 'Off' }, { id: 'yes', name: 'On' }]} selected={options?.usePlanterBox ? 'yes' : 'no'}
      onSelect={(id) => updateOptions({ usePlanterBox: id === 'yes' })} />
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Special instructions</Text>
      <TextInput accessibilityLabel="Special instructions" style={styles.input} multiline value={draft.prompt || ''}
        onChangeText={(prompt) => updateDraft({ prompt: prompt || undefined })}
        placeholder="Optional — describe anything else you want" placeholderTextColor={theme.colors.textSecondary} />
    </View>
  </View>;
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { marginTop: 20, gap: 22 },
  section: { gap: 10 },
  heading: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface, maxWidth: '100%' },
  selected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.borderLight },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: theme.colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: theme.colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: theme.colors.textSecondary },
  label: { color: theme.colors.text, fontSize: 15, flexShrink: 1 },
  input: { minHeight: 100, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, color: theme.colors.text, backgroundColor: theme.colors.surface, textAlignVertical: 'top', fontSize: 16 },
});

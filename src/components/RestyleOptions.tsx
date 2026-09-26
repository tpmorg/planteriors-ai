import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_RESTYLE, RESTYLE_AMOUNTS, RESTYLE_STYLES } from '../designFlow/designFlow';
import type { DesignFlowDraft, RestyleChoice } from '../types';

type Choice = { id: string; name: string; description?: string };

function RadioSection({ title, choices, selected, onSelect, layout = 'column' }: {
  title: string;
  choices: Choice[];
  selected?: string;
  onSelect: (id: string) => void;
  layout?: 'column' | 'row';
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
    <View style={layout === 'row' ? styles.row : styles.column}>
      {choices.map((choice) => <Pressable key={choice.id} accessibilityRole="radio"
        accessibilityLabel={`${title}: ${choice.name}`} accessibilityState={{ checked: selected === choice.id }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={() => onSelect(choice.id)} style={({ pressed }) => [styles.choice, layout === 'row' && styles.rowChoice, selected === choice.id && styles.selected, pressed && styles.choicePressed]}>
        <View style={[styles.radio, selected === choice.id && styles.radioSelected]}>
          {selected === choice.id ? <View style={styles.dot} /> : null}
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>{choice.name}</Text>
          {choice.description ? <Text style={styles.description}>{choice.description}</Text> : null}
        </View>
      </Pressable>)}
    </View>
  </View>;
}

export function RestyleOptions({ draft, updateDraft }: {
  draft: DesignFlowDraft;
  updateDraft: (patch: Partial<DesignFlowDraft>) => void;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const restyle = draft.restyle || DEFAULT_RESTYLE;
  const updateRestyle = (patch: Partial<RestyleChoice>) => updateDraft({ restyle: { ...restyle, ...patch } });
  return <View style={styles.container}>
    <RadioSection title="Style" selected={restyle.styleId}
      choices={RESTYLE_STYLES.map((style) => ({ id: style.id, name: style.name, description: style.tagline }))}
      onSelect={(id) => updateRestyle({ styleId: RESTYLE_STYLES.find((style) => style.id === id)!.id })} />
    <RadioSection title="Amount" layout="row" selected={restyle.amount} choices={RESTYLE_AMOUNTS}
      onSelect={(id) => updateRestyle({ amount: RESTYLE_AMOUNTS.find((amount) => amount.id === id)!.id })} />
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
  column: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  choice: { minHeight: 56, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
  rowChoice: { flex: 1 },
  selected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.borderLight },
  choicePressed: { opacity: 0.85 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: theme.colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: theme.colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  copy: { flex: 1 },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  description: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  input: { minHeight: 100, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, color: theme.colors.text, backgroundColor: theme.colors.surface, textAlignVertical: 'top', fontSize: 16 },
});

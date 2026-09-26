import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, Pressable, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import { DesignFlowShell } from '../components/DesignFlowShell';
import { RestyleOptions } from '../components/RestyleOptions';
import { useTheme } from '../contexts/ThemeContext';
import type { DesignFlowDraft, PlantSize } from '../types';

type Group = 'plants' | 'preferences';
type Leaf = 'species' | 'size' | 'placement' | 'instructions';

export function DesignCustomizeScreen({ draft, updateDraft, onChoosePlant, onChooseSpot, onDone, onBack, onClose }: {
  draft: DesignFlowDraft;
  updateDraft: (patch: Partial<DesignFlowDraft>) => void;
  onChoosePlant: () => void;
  onChooseSpot: () => void;
  onDone: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [group, setGroup] = useState<Group | null>(null);
  const [leaf, setLeaf] = useState<Leaf | null>(null);
  const [page, setPage] = useState(0);
  const [prompt, setPrompt] = useState(draft.prompt || '');
  const isRestyle = draft.intent === 'restyle';

  const groups = useMemo(() => [
    { id: 'plants' as Group, title: 'Plant and placement', detail: `${draft.individualPlant?.plant.name} • ${draft.individualPlant?.size} • ${draft.location ? 'chosen spot' : 'automatic'}` },
    { id: 'preferences' as Group, title: 'Preferences', detail: draft.prompt ? 'Instructions added' : 'No special instructions' },
  ], [draft]);

  const leaves: Record<Group, Array<{ id: Leaf; title: string; detail: string }>> = {
    plants: [
      { id: 'species', title: 'Plant', detail: draft.individualPlant?.plant.name || '' },
      { id: 'size', title: 'Size', detail: draft.individualPlant?.size || '' },
      { id: 'placement', title: 'Placement', detail: draft.location ? 'Chosen spot' : 'Automatic' },
    ],
    preferences: [
      { id: 'instructions', title: 'Special instructions', detail: draft.prompt ? 'Added' : 'Optional' },
    ],
  };

  const setOptions = (values: Array<{ id: string; name: string }>, currentId: string | undefined, choose: (id: string) => void) => {
    const pages = Math.max(1, Math.ceil(values.length / 3));
    const visible = values.slice(page * 3, page * 3 + 3);
    return <><View style={styles.optionList}>{visible.map((value) => <Pressable key={value.id} accessibilityRole="radio" accessibilityLabel={value.name} accessibilityState={{ checked: currentId === value.id }} style={({ pressed }) => [styles.option, currentId === value.id && styles.optionSelected, pressed && styles.rowPressed]} onPress={() => { choose(value.id); setLeaf(null); setPage(0); }}><Text style={[styles.optionTitle, currentId === value.id && styles.optionTitleSelected]}>{value.name}</Text>{currentId === value.id ? <AppIcon name="Check" size={18} color={theme.colors.primary} /> : null}</Pressable>)}</View>{pages > 1 ? <View style={styles.pages}><AppButton variant="ghost" size="sm" title="Previous" disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} /><Text style={styles.pageLabel}>{page + 1} of {pages}</Text><AppButton variant="ghost" size="sm" title="Next" disabled={page === pages - 1} onPress={() => setPage((value) => Math.min(pages - 1, value + 1))} /></View> : null}</>;
  };

  const renderLeaf = () => {
    if (!leaf) return null;
    if (leaf === 'species' || leaf === 'placement') return null;
    if (leaf === 'size') {
      const sizes = draft.individualPlant?.plant.availableSizes || [];
      return setOptions(sizes.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) })), draft.individualPlant?.size, (id) => updateDraft({ individualPlant: { ...draft.individualPlant!, size: id as PlantSize } }));
    }
    if (leaf === 'instructions') return <View style={styles.instructions}><TextInput style={styles.textArea} multiline value={prompt} onChangeText={setPrompt} placeholder="Describe anything else you want" placeholderTextColor={theme.colors.textSecondary} /><AppButton title="Apply instructions" onPress={() => { updateDraft({ prompt: prompt.trim() || undefined }); setLeaf(null); }} testID="customize-apply" /></View>;
    return null;
  };

  const back = () => {
    if (leaf) { setLeaf(null); setPage(0); return; }
    if (group) { setGroup(null); return; }
    onBack();
  };
  const title = leaf ? leaves[group!].find((value) => value.id === leaf)?.title || 'Customize' : group ? groups.find((value) => value.id === group)?.title || 'Customize' : 'Customize';
  // Older persisted drafts can still resume on this route.
  if (isRestyle) return <DesignFlowShell title="Style your room" onBack={onBack} onClose={onClose} scroll
    footer={<AppButton title="Done" size="lg" elevated onPress={onDone} testID="customize-done" />}>
    <RestyleOptions draft={draft} updateDraft={updateDraft} />
  </DesignFlowShell>;
  return (
    <DesignFlowShell title={title} subtitle={leaf ? 'Choose one setting' : 'Optional changes'} onBack={back} onClose={onClose}
      footer={!group && !leaf ? <AppButton title="Done" size="lg" elevated onPress={onDone} testID="customize-done" /> : undefined}>
      {!group && !leaf ? <View style={styles.list}>{groups.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.title} accessibilityHint={item.detail} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => setGroup(item.id)}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowDetail}>{item.detail}</Text></View><AppIcon name="CaretRight" size={18} color={theme.colors.textSecondary} /></Pressable>)}</View> : null}
      {group && !leaf ? <View style={styles.list}>{leaves[group].map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.title} accessibilityHint={`Current: ${item.detail}`} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => {
        if (item.id === 'species') { onChoosePlant(); return; }
        if (item.id === 'placement') { onChooseSpot(); return; }
        setLeaf(item.id);
      }}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowDetail}>{item.detail}</Text></View><AppIcon name="CaretRight" size={18} color={theme.colors.textSecondary} /></Pressable>)}</View> : null}
      {renderLeaf()}
    </DesignFlowShell>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  list: { flex: 1, justifyContent: 'center', gap: 12 },
  row: { minHeight: 82, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 16, flexDirection: 'row', alignItems: 'center' },
  rowCopy: { flex: 1 }, rowTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '800' }, rowDetail: { color: theme.colors.textSecondary, marginTop: 5, textTransform: 'capitalize' }, rowPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  optionList: { flex: 1, justifyContent: 'center', gap: 12 }, option: { minHeight: 72, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, optionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.borderLight }, optionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700' }, optionTitleSelected: { color: theme.colors.primary },
  pages: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }, pageLabel: { color: theme.colors.textSecondary },
  instructions: { flex: 1, justifyContent: 'center', gap: 14 }, textArea: { minHeight: 150, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, color: theme.colors.text, padding: 16, textAlignVertical: 'top', fontSize: 16 },
});

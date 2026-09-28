import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import { DesignFlowShell } from '../components/DesignFlowShell';
import { RestyleOptions } from '../components/RestyleOptions';
import { useTheme } from '../contexts/ThemeContext';
import type { DesignFlowDraft } from '../types';

// Restyle shows its editable options instead of a summary.
function summaryFor(draft: DesignFlowDraft) {
  return [
    draft.individualPlant?.plant.name,
    draft.individualPlant ? `${draft.individualPlant.size} size` : undefined,
    draft.location ? (draft.intent === 'replace' ? 'Target marked' : 'Chosen spot') : 'Automatic placement',
  ].filter(Boolean);
}

export function DesignReadyScreen({ draft, updateDraft, onBack, onClose, onGenerate, onRecover, onCustomize, onChooseSpot, onChangeTarget, allowanceText }: {
  draft: DesignFlowDraft;
  updateDraft: (patch: Partial<DesignFlowDraft>) => void;
  onBack: () => void;
  onClose: () => void;
  onGenerate: () => void;
  onRecover: () => void;
  onCustomize: () => void;
  onChooseSpot: () => void;
  onChangeTarget: () => void;
  allowanceText: string;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const isRestyle = draft.intent === 'restyle';
  const title = isRestyle ? 'Style your room' : draft.intent === 'replace' ? 'Ready to replace' : 'Ready to add';
  return (
    <DesignFlowShell title={title} subtitle={isRestyle ? 'Make it yours, then generate' : 'Review the setup before generation'} onBack={onBack} onClose={onClose} scroll
      footer={<><Text style={styles.allowance}>{allowanceText}</Text><AppButton title={draft.requestStatus === 'unknown' && draft.requestId ? 'Check previous request' : 'Generate design'} icon="ArrowRight" iconPosition="right" size="lg" elevated onPress={draft.requestStatus === 'unknown' && draft.requestId ? onRecover : onGenerate} testID="generate-design" /></>}>
      <View style={[styles.photoWrap, isRestyle && styles.restylePhoto]}>
        <Image source={{ uri: draft.refinementSourceUri || draft.photo?.originalUri }} style={styles.photo} resizeMode="cover" />
        {draft.refinementSourceUri ? <View style={styles.adjustingBadge}><Text style={styles.adjustingBadgeText}>Adjusting latest result</Text></View> : null}
      </View>
      {isRestyle ? <RestyleOptions draft={draft} updateDraft={updateDraft} /> : <View style={styles.summary}>
        <Text style={styles.eyebrow}>YOUR SETUP</Text>
        {summaryFor(draft).map((value) => <View key={value} style={styles.row}><AppIcon name="CheckCircle" size={18} color={theme.colors.primary} /><Text style={styles.rowText}>{value}</Text></View>)}
      </View>}
      {draft.requestStatus === 'unknown' ? <View style={styles.unknownNotice}><AppIcon name="WarningCircle" size={18} color="#b45309" /><Text style={styles.unknownText}>The previous request was interrupted. Check its result before starting another design.</Text></View> : null}
      {!isRestyle ? <View style={styles.secondaryActions}>
        {draft.intent === 'add' ? <AppButton variant="secondary" title={draft.location ? 'Change spot' : 'Choose a spot'} onPress={onChooseSpot} style={styles.flexButton} /> : null}
        {draft.intent === 'replace' ? <AppButton variant="secondary" title="Change target" onPress={onChangeTarget} style={styles.flexButton} /> : null}
        <AppButton variant="secondary" title="Customize" onPress={onCustomize} style={styles.flexButton} />
      </View> : null}
    </DesignFlowShell>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  photoWrap: { marginTop: 10, height: 235, borderRadius: 22, overflow: 'hidden', backgroundColor: theme.colors.borderLight },
  restylePhoto: { height: 140 },
  photo: { width: '100%', height: '100%' },
  adjustingBadge: { position: 'absolute', left: 12, top: 12, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: 'rgba(0,0,0,0.72)' },
  adjustingBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  summary: { marginTop: 18, padding: 17, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, gap: 11 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: theme.colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 15, color: theme.colors.text, textTransform: 'capitalize' },
  secondaryActions: { marginTop: 14, flexDirection: 'row', gap: 10 },
  flexButton: { flex: 1 },
  unknownNotice: { marginTop: 12, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: theme.isDark ? 'rgba(180,83,9,0.16)' : '#fffbeb', borderWidth: 1, borderColor: theme.isDark ? 'rgba(245,158,11,0.35)' : '#fde68a' },
  unknownText: { flex: 1, color: theme.colors.text, fontSize: 12, lineHeight: 17 },
  allowance: { color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 9 },
});

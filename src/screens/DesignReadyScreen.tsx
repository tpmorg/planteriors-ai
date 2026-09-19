import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '../components/AppIcon';
import { DesignFlowShell } from '../components/DesignFlowShell';
import { useTheme } from '../contexts/ThemeContext';
import type { DesignFlowDraft } from '../types';

function summaryFor(draft: DesignFlowDraft) {
  if (draft.intent === 'restyle') {
    return [draft.plantType?.name, draft.plantStyle?.name, draft.plantOptions?.placementDensity.name, `${draft.plantOptions?.maintenanceLevel.name} care`].filter(Boolean);
  }
  return [
    draft.individualPlant?.plant.name,
    draft.individualPlant ? `${draft.individualPlant.size} size` : undefined,
    draft.location ? (draft.intent === 'replace' ? 'Target marked' : 'Chosen spot') : 'Automatic placement',
  ].filter(Boolean);
}

export function DesignReadyScreen({ draft, onBack, onClose, onGenerate, onCustomize, onChooseSpot, onChangeTarget, onReplacePhoto, onCropPhoto, allowanceText }: {
  draft: DesignFlowDraft;
  onBack: () => void;
  onClose: () => void;
  onGenerate: () => void;
  onCustomize: () => void;
  onChooseSpot: () => void;
  onChangeTarget: () => void;
  onReplacePhoto: () => void;
  onCropPhoto: () => void;
  allowanceText: string;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const title = draft.intent === 'restyle' ? 'Ready to restyle' : draft.intent === 'replace' ? 'Ready to replace' : 'Ready to add';
  return (
    <DesignFlowShell title={title} subtitle="Review the setup before generation" onBack={onBack} onClose={onClose}
      footer={<><Text style={styles.allowance}>{allowanceText}</Text><TouchableOpacity style={styles.primary} onPress={onGenerate}><Text style={styles.primaryText}>Generate design</Text><AppIcon name="ArrowRight" size={19} color="white" /></TouchableOpacity></>}>
      <View style={styles.photoWrap}>
        <Image source={{ uri: draft.refinementSourceUri || draft.photo?.originalUri }} style={styles.photo} resizeMode="cover" />
        {draft.refinementSourceUri ? <View style={styles.adjustingBadge}><Text style={styles.adjustingBadgeText}>Adjusting latest result</Text></View> : null}
        <TouchableOpacity style={styles.editPhoto} onPress={() => Alert.alert('Edit photo', undefined, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace photo', onPress: onReplacePhoto },
          { text: 'Crop center', onPress: onCropPhoto },
        ])}><AppIcon name="PencilSimple" size={16} color="white" /><Text style={styles.editPhotoText}>Edit photo</Text></TouchableOpacity>
      </View>
      <View style={styles.summary}>
        <Text style={styles.eyebrow}>YOUR SETUP</Text>
        {summaryFor(draft).map((value) => <View key={value} style={styles.row}><AppIcon name="CheckCircle" size={18} color={theme.colors.primary} /><Text style={styles.rowText}>{value}</Text></View>)}
      </View>
      {draft.requestStatus === 'unknown' ? <View style={styles.unknownNotice}><AppIcon name="WarningCircle" size={18} color="#b45309" /><Text style={styles.unknownText}>The previous request has an unknown status. Generating again starts a new request.</Text></View> : null}
      <View style={styles.secondaryActions}>
        {draft.intent === 'add' ? <TouchableOpacity style={styles.secondary} onPress={onChooseSpot}><Text style={styles.secondaryText}>{draft.location ? 'Change spot' : 'Choose a spot'}</Text></TouchableOpacity> : null}
        {draft.intent === 'replace' ? <TouchableOpacity style={styles.secondary} onPress={onChangeTarget}><Text style={styles.secondaryText}>Change target</Text></TouchableOpacity> : null}
        <TouchableOpacity style={styles.secondary} onPress={onCustomize}><Text style={styles.secondaryText}>Customize</Text></TouchableOpacity>
      </View>
    </DesignFlowShell>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  photoWrap: { marginTop: 10, height: 235, borderRadius: 22, overflow: 'hidden', backgroundColor: theme.colors.borderLight },
  photo: { width: '100%', height: '100%' },
  editPhoto: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.7)' },
  editPhotoText: { color: 'white', fontSize: 13, fontWeight: '700' },
  adjustingBadge: { position: 'absolute', left: 12, top: 12, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: 'rgba(0,0,0,0.72)' },
  adjustingBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  summary: { marginTop: 18, padding: 17, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, gap: 11 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: theme.colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 15, color: theme.colors.text, textTransform: 'capitalize' },
  secondaryActions: { marginTop: 14, flexDirection: 'row', gap: 10 },
  unknownNotice: { marginTop: 12, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: theme.isDark ? 'rgba(180,83,9,0.16)' : '#fffbeb', borderWidth: 1, borderColor: theme.isDark ? 'rgba(245,158,11,0.35)' : '#fde68a' },
  unknownText: { flex: 1, color: theme.colors.text, fontSize: 12, lineHeight: 17 },
  secondary: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, paddingHorizontal: 8 },
  secondaryText: { color: theme.colors.text, fontWeight: '700', textAlign: 'center' },
  primary: { minHeight: 54, borderRadius: 18, backgroundColor: theme.colors.primary, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '800' },
  allowance: { color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 9 },
});

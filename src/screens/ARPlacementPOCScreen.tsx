import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';

import { AppIcon } from '../components/AppIcon';
import { useTheme, type Theme } from '../contexts/ThemeContext';
import {
  ARPlacementView,
  createViroAdapter,
  useARPlacement,
  type ContentDescriptor,
  type FeedbackSnapshot,
  type RenderObject,
} from '../modules/ar-placement';

const POT: ContentDescriptor = {
  contentId: 'pot-proxy',
  dimensions: { width: 0.27, height: 0.4, depth: 0.27 },
  pivot: [0, 0.2, 0],
  minScale: 0.5,
  maxScale: 2,
};



function feedbackCopy(feedback: FeedbackSnapshot): string {
  switch (feedback.code) {
    case 'scan.moveSlowly':
      return 'Move your phone slowly to find a floor or table.';
    case 'tracking.insufficientFeatures':
      return 'Tracking is limited — not enough visible detail.';
    case 'tracking.excessiveMotion':
      return 'Tracking is limited — moving too fast.';
    case 'tracking.limited':
      return 'Tracking is limited.';
    case 'target.outOfRange':
      return 'Aim closer to a detected surface.';
    case 'target.ready':
      return 'Ready — tap Place.';
    case 'target.acquiring':
      return 'Hold still on the surface.';
    case 'target.none':
      return 'Point the reticle at a highlighted surface.';
    case 'placement.lost':
      return 'Placement was lost. Place again.';
    case 'session.restarted':
      return 'Session restarted. Previous placements were cleared.';
    case 'session.permissionDenied':
      return 'Camera permission is off.';
    case 'session.unsupported':
      return 'AR is not available in this build.';
    case 'session.failed':
      return String(feedback.params.message ?? 'AR session failed.');
    case 'session.interrupted':
      return 'AR session interrupted.';
    case 'placement.confirmed':
      return 'Placement confirmed.';
    default:
      return feedback.code;
  }
}

export function ARPlacementPOCScreen({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [adapter] = useState(() => createViroAdapter());
  const [renderObject, setRenderObject] = useState<RenderObject | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showOverlays, setShowOverlays] = useState(false);
  const ar = useARPlacement({
    adapter,
    contents: [POT],
    policy: { maxObjects: 2 },
    hostMeta: {
      platform: Platform.OS,
      appRevision: Constants.expoConfig?.version,
      buildId: String(Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? ''),
    },
  });
  const { snapshot } = ar;
  const selected = snapshot.objects.find((object) => object.id === snapshot.selection) ?? snapshot.objects[0];
  const canPlace =
    snapshot.session.lifecycle === 'running' &&
    snapshot.session.tracking === 'normal' &&
    snapshot.target?.ready === true &&
    snapshot.objects.filter((object) => object.lifecycle !== 'lost').length < snapshot.policy.maxObjects;
  const canEdit = selected && (selected.lifecycle === 'placed' || selected.lifecycle === 'moving');

  const started = snapshot.session.lifecycle === 'running' || snapshot.session.lifecycle === 'starting';

  const handleStart = useCallback(async () => {
    if (!renderObject) {
      const mod = await import('./arLabPotProxy');
      setRenderObject(() => mod.renderPot);
    }
    await ar.start();
  }, [ar, renderObject]);

  const handleExport = useCallback(async () => {
    const report = ar.exportDiagnostics();
    const path = `${FileSystem.cacheDirectory}ar-placement-trace.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(report, null, 2));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/json', UTI: 'public.json' });
    }
  }, [ar]);

  if (snapshot.session.lifecycle === 'idle' || snapshot.session.lifecycle === 'checking') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          {snapshot.session.lifecycle === 'checking' ? <ActivityIndicator color={theme.colors.primary} /> : null}
          <Text style={styles.title}>AR placement lab</Text>
          <Text style={styles.body}>Horizontal surface placement module. Camera is not acquired until Start.</Text>
          <TouchableOpacity style={styles.primary} onPress={() => void handleStart()}>
            <Text style={styles.primaryText}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Text style={styles.link}>Back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (snapshot.session.lifecycle === 'failed' || snapshot.session.failure?.code === 'permission-denied') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.title}>{feedbackCopy(snapshot.feedback)}</Text>
          <Text style={styles.body}>{snapshot.session.failure?.message}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => void handleStart()}>
            <Text style={styles.primaryText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Text style={styles.link}>Back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.ar}>
      {renderObject ? (
        <ARPlacementView
          controller={ar.controller}
          showOverlays={showOverlays}
          renderObject={renderObject}
        />
      ) : (
        <View style={styles.ar} />
      )}
      <View pointerEvents="none" style={styles.reticle} />
      <SafeAreaView style={styles.top} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.icon} onPress={() => { void ar.stop(); onClose(); }}>
            <AppIcon name="X" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.hudTitle}>AR placement lab</Text>
          <TouchableOpacity style={styles.icon} onPress={() => setShowDiagnostics((value) => !value)}>
            <AppIcon name={showDiagnostics ? 'EyeSlash' : 'Eye'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{feedbackCopy(snapshot.feedback)}</Text>
        </View>
      </SafeAreaView>
      <SafeAreaView style={styles.bottom} edges={['bottom']}>
        <ScrollView style={styles.panel}>
          {showDiagnostics ? (
            <View style={styles.diag}>
              <Text style={styles.diagLine}>lifecycle {snapshot.session.lifecycle} · tracking {snapshot.session.tracking}</Text>
              <Text style={styles.diagLine}>
                surfaces native {snapshot.diagnostics.nativeSurfaceCount} / accepted {snapshot.diagnostics.acceptedSurfaceCount} (adapter-owned)
              </Text>
              <Text style={styles.diagLine}>
                objects {snapshot.diagnostics.ownedPlacementCount} · pending release {snapshot.diagnostics.pendingReleaseCount}
              </Text>
              <Text style={styles.diagLine}>
                target {snapshot.target?.surfaceId ?? 'none'} ready={String(snapshot.target?.ready ?? false)} heuristic
              </Text>
              <Text style={styles.diagLine}>events {snapshot.diagnostics.eventCount} dropped {snapshot.diagnostics.droppedEvents}</Text>
              <TouchableOpacity onPress={() => setShowOverlays((value) => !value)}>
                <Text style={styles.link}>{showOverlays ? 'Hide plane overlays' : 'Show plane overlays'}</Text>
              </TouchableOpacity>
              {snapshot.objects.map((object) => (
                <TouchableOpacity key={object.id} onPress={() => ar.select(object.id)}>
                  <Text style={styles.diagLine}>
                    {object.id === snapshot.selection ? '▸ ' : '  '}
                    {object.id} {object.lifecycle} yaw {(object.localTransform.yawRadians).toFixed(2)} scale {object.localTransform.scale.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => void handleExport()}><Text style={styles.link}>Export diagnostics</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => ar.clearDiagnostics()}><Text style={styles.link}>Clear diagnostics</Text></TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.row}>
            <HudButton label="Place" disabled={!canPlace} onPress={() => void ar.place({ contentId: 'pot-proxy' })} />
            <HudButton label="Confirm" disabled={!canEdit || snapshot.session.tracking !== 'normal'} onPress={() => selected && void ar.confirm(selected.id)} />
          </View>
          <View style={styles.row}>
            <HudButton label="Move" disabled={!canEdit} onPress={() => selected && void ar.beginMove(selected.id)} />
            <HudButton label="Commit move" disabled={selected?.lifecycle !== 'moving'} onPress={() => selected && void ar.commitMove(selected.id)} />
            <HudButton label="Cancel move" disabled={selected?.lifecycle !== 'moving'} onPress={() => selected && void ar.cancelMove(selected.id)} />
          </View>
          <View style={styles.row}>
            <HudButton label="Yaw -" disabled={!canEdit} onPress={() => selected && void ar.setTransform(selected.id, { yawRadians: selected.localTransform.yawRadians - 0.26 })} />
            <HudButton label="Yaw +" disabled={!canEdit} onPress={() => selected && void ar.setTransform(selected.id, { yawRadians: selected.localTransform.yawRadians + 0.26 })} />
            <HudButton label="Smaller" disabled={!canEdit} onPress={() => selected && void ar.setTransform(selected.id, { scale: selected.localTransform.scale - 0.1 })} />
            <HudButton label="Larger" disabled={!canEdit} onPress={() => selected && void ar.setTransform(selected.id, { scale: selected.localTransform.scale + 0.1 })} />
          </View>
          <View style={styles.row}>
            <HudButton label="Remove" disabled={!selected} onPress={() => selected && void ar.remove(selected.id)} />
            <HudButton label="Clear" disabled={snapshot.objects.length === 0} onPress={() => void ar.clear()} />
            <HudButton label="Reset" disabled={!started} onPress={() => void ar.reset()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function HudButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[hud.button, disabled && hud.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={hud.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const hud = StyleSheet.create({
  button: { flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.35 },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    title: { color: theme.colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    body: { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16 },
    primary: { backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    primaryText: { color: '#fff', fontWeight: '700' },
    link: { color: '#9cdcff', marginTop: 12 },
    ar: { flex: 1, backgroundColor: '#000' },
    reticle: {
      position: 'absolute',
      top: '42%',
      alignSelf: 'center',
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: '#fff',
    },
    top: { position: 'absolute', top: 0, left: 0, right: 0 },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    hudTitle: { flex: 1, textAlign: 'center', color: '#fff', fontWeight: '700' },
    pill: { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginTop: 8 },
    pillText: { color: '#fff', fontSize: 12 },
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '48%' },
    panel: { backgroundColor: 'rgba(0,0,0,0.62)', padding: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    diag: { backgroundColor: 'rgba(255,255,255,0.08)', padding: 8, borderRadius: 10, marginBottom: 8 },
    diagLine: { color: '#fff', fontSize: 11, lineHeight: 16 },
    row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  });

export default ARPlacementPOCScreen;

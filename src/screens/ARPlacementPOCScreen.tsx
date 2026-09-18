/**
 * Development-only AR surface placement POC screen.
 *
 * Responsibilities:
 * - Capability/permission guard before any AR work happens (Expo Go, web, unsupported
 *   devices and development clients built without Viro get an explanation and Back).
 * - Lifecycle: the AR view owns the camera while mounted and is unmounted when the app
 *   backgrounds or the screen is left. Foregrounding starts a fresh session and asks the
 *   user to place again rather than restoring an old transform.
 * - React Native controls + a compact diagnostic panel for the Viro scene.
 *
 * The Viro dependency is loaded with a dynamic `import()` only after the guards pass, so
 * opening ordinary app screens never initialises AR.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';

import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../contexts/ThemeContext';
import {
  type ARPlacementSceneApi,
  type ARPlacementStatus,
  NO_PLANE_GUIDANCE_MS,
  canAdjust,
  canConfirm,
  createInitialARPlacementState,
  describeTrackingState,
  statusCopy,
} from '../components/ar/placementState';

type GuardPhase = 'checking' | 'unsupported' | 'permission-denied' | 'ready';

type FailureCode =
  | 'not-development'
  | 'unsupported-platform'
  | 'missing-native-module'
  | 'viro-module-error'
  | 'ar-not-supported'
  | 'camera-permission-denied'
  | 'camera-permission-error'
  | 'unknown-error';

interface ARPlacementPOCScreenProps {
  onClose: () => void;
}

/**
 * Native module names registered by @reactvision/react-viro@2.53.1 (verified in the
 * installed release): `VRTARSceneNavigatorModule` on both platforms and `VRTARUtils`
 * on iOS. Their absence means the running binary was built without Viro (Expo Go or an
 * older development client), which we can detect without touching the JS library.
 */
function hasViroNativeModules(): boolean {
  try {
    const modules = NativeModules as Record<string, unknown> | undefined;
    if (!modules?.VRTARSceneNavigatorModule) return false;
    if (Platform.OS === 'ios' && !modules.VRTARUtils) return false;
    return true;
  } catch (error) {
    // Accessing a TurboModule registry entry can throw on some runtimes; treat any
    // failure as "Viro is not available" rather than crashing the guard.
    console.warn('AR POC: native module probe failed', error);
    return false;
  }
}

function createSessionId(): string {
  return `ar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function failureCopy(code: FailureCode): { title: string; body: string } {
  switch (code) {
    case 'not-development':
      return {
        title: 'Not available in production builds',
        body: 'The AR placement proof of concept is a development-only screen and is disabled outside __DEV__ builds.',
      };
    case 'unsupported-platform':
      return {
        title: 'AR needs a phone',
        body: 'This proof of concept runs on physical iOS and Android phones only. Web and other platforms are not supported.',
      };
    case 'missing-native-module':
      return {
        title: 'This build has no AR module',
        body: 'ViroReact is a native module, so it is not available in Expo Go and it is not present in the development client that is currently installed. Rebuild the development client (see docs/ar-placement-poc-validation.md), then reopen this screen.',
      };
    case 'viro-module-error':
      return {
        title: 'AR module failed to load',
        body: 'The ViroReact JavaScript module could not be initialised. This usually means the installed development client does not match the pinned ViroReact version.',
      };
    case 'ar-not-supported':
      return {
        title: 'AR is not supported here',
        body: 'isARSupportedOnDevice() reported that this device or runtime cannot run an AR session. A simulator cannot run ARKit, and some Android devices lack ARCore support.',
      };
    case 'camera-permission-denied':
      return {
        title: 'Camera permission is off',
        body: 'AR needs camera access to detect a surface. Enable camera access for this app in system settings, then reopen this screen.',
      };
    case 'camera-permission-error':
      return {
        title: 'Camera permission could not be checked',
        body: 'The camera permission check failed. Reopen the screen and try again.',
      };
    case 'unknown-error':
      return {
        title: 'AR could not be prepared',
        body: 'Something went wrong while preparing the AR session. Reopen the screen and try again, or check the device logs.',
      };
  }
}

/**
 * Isolated timer so the per-second tick re-renders only this small component — never the
 * AR navigator or the scene.
 */
const ScanProgress = React.memo(function ScanProgress({
  running,
  showGuidance,
  onRetry,
}: {
  running: boolean;
  showGuidance: boolean;
  onRetry: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  const needsGuidance = running && showGuidance && seconds * 1000 >= NO_PLANE_GUIDANCE_MS;

  return (
    <View>
      <Text style={hudStyles.diagLine}>
        Scan time: <Text style={hudStyles.diagValue}>{running ? `${seconds}s` : 'paused'}</Text>
      </Text>
      {needsGuidance ? (
        <View style={hudStyles.guidance}>
          <AppIcon name="WarningCircle" size={18} color="#ffd166" />
          <View style={hudStyles.guidanceTextWrap}>
            <Text style={hudStyles.guidanceText}>
              Still no surface after {Math.round(NO_PLANE_GUIDANCE_MS / 1000)}s. Try better
              lighting, and sweep the phone slowly across a textured floor or table.
            </Text>
          </View>
          <TouchableOpacity
            style={hudStyles.guidanceButton}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry surface detection"
          >
            <Text style={hudStyles.guidanceButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

export function ARPlacementPOCScreen({ onClose }: ARPlacementPOCScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [phase, setPhase] = useState<GuardPhase>('checking');
  const [failure, setFailure] = useState<FailureCode | null>(null);
  const [sessionId, setSessionId] = useState(() => createSessionId());
  const [sceneMounted, setSceneMounted] = useState(false);
  const [status, setStatus] = useState<ARPlacementStatus | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const sceneApiRef = useRef<ARPlacementSceneApi | null>(null);
  const modulesRef = useRef<{
    // Loose typing on purpose: the props are declared by the Viro library, and `any`
    // keeps this guard module free of a static Viro import.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Navigator: React.ComponentType<any>;
    Scene: () => React.JSX.Element;
  } | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- Capability + permission guard -------------------------------------------

  const runGuards = useCallback(async () => {
    mountedRef.current = true;
    setPhase('checking');
    setFailure(null);
    sceneApiRef.current = null;

    if (!__DEV__) {
      setFailure('not-development');
      setPhase('unsupported');
      return;
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      setFailure('unsupported-platform');
      setPhase('unsupported');
      return;
    }

    if (!hasViroNativeModules()) {
      // Expo Go, an older development client, or a build without the Viro plugin.
      setFailure('missing-native-module');
      setPhase('unsupported');
      return;
    }

    // Camera permission is checked/requested without mounting expo-camera's CameraView:
    // the AR view owns the camera while this screen is active.
    try {
      const current = await Camera.getCameraPermissionsAsync();
      let granted = current.granted;
      if (!granted && current.canAskAgain) {
        const requested = await Camera.requestCameraPermissionsAsync();
        granted = requested.granted;
      }
      if (!granted) {
        setFailure('camera-permission-denied');
        setPhase('permission-denied');
        return;
      }
    } catch (error) {
      console.warn('AR POC: camera permission check failed', error);
      setFailure('camera-permission-error');
      setPhase('permission-denied');
      return;
    }

    // Everything below loads the native Viro module, which is only safe now that the
    // native module presence check passed.
    try {
      const bridge = await import('../components/ar/viroBridge');
      const support = await bridge.isARSupportedOnDevice();
      if (!support?.isARSupported) {
        setFailure('ar-not-supported');
        setPhase('unsupported');
        return;
      }

      const sceneModule = await import('../components/ar/ARPlacementScene');
      modulesRef.current = {
        Navigator: bridge.ViroARSceneNavigator,
        // The navigator types `initialScene.scene` as `() => JSX.Element`; the POC scene is
        // a function component that the navigator renders without props, so this cast only
        // widens the parameter list.
        Scene: sceneModule.ARPlacementScene as unknown as () => React.JSX.Element,
      };
    } catch (error) {
      console.warn('AR POC: Viro module failed to load', error);
      setFailure('viro-module-error');
      setPhase('unsupported');
      return;
    }

    if (!mountedRef.current) return;
    setSessionId(createSessionId());
    setStatus(null);
    setSceneMounted(true);
    setPhase('ready');
  }, []);

  const startGuards = useCallback(() => {
    runGuards().catch((error) => {
      // Never leave the screen stuck on the spinner, and never surface an unhandled
      // rejection from a guard.
      console.warn('AR POC: capability guard failed unexpectedly', error);
      if (!mountedRef.current) return;
      setFailure('unknown-error');
      setPhase('unsupported');
    });
  }, [runGuards]);

  useEffect(() => {
    startGuards();
  }, [startGuards]);

  // --- Lifecycle: release the camera when backgrounded, fresh session on return -----

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const previous = appStateRef.current;
      appStateRef.current = next;

      if (next === 'background' || next === 'inactive') {
        // Unmount the navigator so the AR session (and camera) is released.
        setSceneMounted(false);
        sceneApiRef.current = null;
        return;
      }

      if (next === 'active' && (previous === 'background' || previous === 'inactive')) {
        // Foregrounding starts a fresh session: old placement state is discarded and the
        // user is asked to place again. No stale anchor is presented as restored.
        setStatus(null);
        sceneApiRef.current = null;
        setSessionId(createSessionId());
        setSceneMounted(true);
      }
    });

    return () => subscription.remove();
  }, []);

  // --- Scene <-> controls bridge ---------------------------------------------------

  const handleStatusChange = useCallback((next: ARPlacementStatus) => {
    setStatus(next);
  }, []);

  const handleSceneReady = useCallback((api: ARPlacementSceneApi) => {
    sceneApiRef.current = api;
  }, []);

  const viroAppProps = useMemo(
    () => ({ sessionId, onStatusChange: handleStatusChange, onReady: handleSceneReady }),
    [sessionId, handleStatusChange, handleSceneReady]
  );

  const initialScene = useMemo(
    () => (modulesRef.current ? { scene: modulesRef.current.Scene } : null),
    // The navigator reads `initialScene` once at construction; it only needs to exist when
    // the navigator is mounted for a given session.
    [phase, sessionId]
  );

  const resetSession = useCallback(() => {
    setStatus(null);
    sceneApiRef.current = null;
    setSessionId(createSessionId());
    setSceneMounted(true);
    setPhase((current) => (current === 'ready' ? 'ready' : current));
  }, []);

  const displayStatus: ARPlacementStatus = useMemo(
    () => status ?? { ...createInitialARPlacementState(sessionId), lastError: null, snapshot: null },
    [status, sessionId]
  );

  const adjustingEnabled = canAdjust(displayStatus);
  const confirmEnabled = canConfirm(displayStatus);
  const isConfirmed = displayStatus.phase === 'confirmed';

  const handleBack = useCallback(() => {
    setSceneMounted(false);
    sceneApiRef.current = null;
    onClose();
  }, [onClose]);

  // --- Terminal states ------------------------------------------------------------

  if (phase === 'checking') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centerContent}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.terminalTitle}>Preparing AR</Text>
          <Text style={styles.terminalBody}>
            Checking AR support and camera permission.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.terminalBackButton}
          onPress={handleBack}
          accessibilityRole="button"
        >
          <Text style={styles.terminalBackText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (phase === 'unsupported' || phase === 'permission-denied') {
    const copy = failureCopy(failure ?? 'unsupported-platform');

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.centerContent}>
          <AppIcon
            name={failure === 'camera-permission-denied' ? 'Camera' : 'Warning'}
            size={40}
            color={theme.colors.primary}
          />
          <Text style={styles.terminalTitle}>{copy.title}</Text>
          <Text style={styles.terminalBody}>{copy.body}</Text>
          <Text style={styles.terminalNote}>
            Surface detection cannot be demonstrated without a physical AR-capable device.
          </Text>
        </ScrollView>
        <View style={styles.terminalActions}>
          {phase === 'permission-denied' ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
              onPress={startGuards}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Try again</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
            onPress={handleBack}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const Navigator = modulesRef.current?.Navigator;

  return (
    <View style={styles.arContainer}>
      {Navigator && sceneMounted ? (
        // Keyed by session so "Reset session" and foregrounding remount a clean AR session
        // instead of reusing stale anchors or callbacks.
        <Navigator
          key={sessionId}
          style={styles.arView}
          initialScene={initialScene ?? undefined}
          viroAppProps={viroAppProps}
          // Scope: phone AR only. No cloud anchors, geospatial services or credentials.
          provider="none"
          autofocus
        />
      ) : (
        <View style={styles.pausedPlaceholder}>
          <Text style={styles.pausedText}>
            AR paused. The camera is released while the app is in the background.
          </Text>
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView
        style={hudStyles.topBarWrap}
        edges={['top', 'left', 'right']}
        pointerEvents="box-none"
      >
        <View style={hudStyles.topBar} pointerEvents="box-none">
          <TouchableOpacity
            style={hudStyles.iconButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Close AR placement proof of concept"
          >
            <AppIcon name="X" size={20} color="#ffffff" weight="bold" />
          </TouchableOpacity>

          <View style={hudStyles.titleWrap} pointerEvents="none">
            <Text style={hudStyles.titleText}>AR placement POC</Text>
            <Text style={hudStyles.subtitleText}>
              {Platform.OS === 'ios'
                ? 'iOS · unverified until tested on device'
                : 'Android · unverified'}
            </Text>
          </View>

          <TouchableOpacity
            style={hudStyles.iconButton}
            onPress={() => setShowDiagnostics((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
          >
            <AppIcon name={showDiagnostics ? 'EyeSlash' : 'Eye'} size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={hudStyles.statusPill} pointerEvents="none">
          <View
            style={[hudStyles.statusDot, { backgroundColor: phaseColor(displayStatus.phase) }]}
          />
          <Text style={hudStyles.statusPillText}>{statusCopy(displayStatus)}</Text>
        </View>
      </SafeAreaView>

      {/* Bottom controls + diagnostics */}
      <SafeAreaView style={hudStyles.bottomWrap} edges={['bottom', 'left', 'right']}>
        <ScrollView
          style={hudStyles.bottomScroll}
          contentContainerStyle={hudStyles.bottomContent}
          keyboardShouldPersistTaps="handled"
        >
          {showDiagnostics ? (
            <View style={hudStyles.diagPanel}>
              <Text style={hudStyles.diagTitle}>Diagnostics</Text>
              <Text style={hudStyles.diagLine}>
                Phase: <Text style={hudStyles.diagValue}>{displayStatus.phase}</Text>
              </Text>
              <Text style={hudStyles.diagLine}>
                Tracking:{' '}
                <Text style={hudStyles.diagValue}>
                  {describeTrackingState(displayStatus.trackingState, displayStatus.trackingReason)}
                  {displayStatus.trackingUsable ? ' · usable' : ' · not usable'}
                </Text>
              </Text>
              <Text style={hudStyles.diagLine}>
                Detected planes (accepted):{' '}
                <Text style={hudStyles.diagValue}>{displayStatus.planeCount}</Text>
              </Text>
              <Text style={hudStyles.diagLine}>
                Selected anchor:{' '}
                <Text style={hudStyles.diagValue}>{displayStatus.anchorId ?? '—'}</Text>
              </Text>
              <Text style={hudStyles.diagLine}>
                Scale / yaw:{' '}
                <Text style={hudStyles.diagValue}>
                  {displayStatus.scale.toFixed(2)}× · {Math.round(displayStatus.rotationYawDeg)}°
                </Text>
              </Text>
              <Text style={hudStyles.diagLine}>
                Local origin:{' '}
                <Text style={hudStyles.diagValue}>
                  [{displayStatus.planeLocalOrigin.join(', ')}] (tap transform applied once by
                  selector)
                </Text>
              </Text>
              {displayStatus.snapshot ? (
                <>
                  <Text style={hudStyles.diagLine}>
                    Snapshot:{' '}
                    <Text style={hudStyles.diagValue}>{displayStatus.snapshot.anchorId}</Text>
                  </Text>
                  <Text style={hudStyles.diagLine}>
                    Size / base offset:{' '}
                    <Text style={hudStyles.diagValue}>
                      {displayStatus.snapshot.widthM.toFixed(2)}m ×{' '}
                      {displayStatus.snapshot.heightM.toFixed(2)}m · base Y{' '}
                      {displayStatus.snapshot.baseContactOffsetY.toFixed(2)}m
                    </Text>
                  </Text>
                  <Text style={hudStyles.diagLine}>
                    Confirmed:{' '}
                    <Text style={hudStyles.diagValue}>
                      {displayStatus.snapshot.confirmedAt
                        ? new Date(displayStatus.snapshot.confirmedAt).toLocaleTimeString()
                        : 'no'}
                    </Text>
                  </Text>
                </>
              ) : null}
              <ScanProgress
                running={sceneMounted && Boolean(Navigator)}
                showGuidance={displayStatus.phase === 'scanning'}
                onRetry={resetSession}
              />
              <Text style={hudStyles.diagLine}>
                Last error:{' '}
                <Text style={hudStyles.diagValue}>{displayStatus.lastError ?? '—'}</Text>
              </Text>
              <Text style={hudStyles.diagLine}>
                Session: <Text style={hudStyles.diagValue}>{sessionId}</Text>
              </Text>
            </View>
          ) : null}

          {isConfirmed ? (
            <View style={hudStyles.confirmedBanner}>
              <AppIcon name="CheckCircle" size={18} color="#7fd6a4" weight="fill" />
              <Text style={hudStyles.confirmedText}>
                Placement confirmed — the marker stays where you put it. Use Edit placement to
                adjust again.
              </Text>
            </View>
          ) : null}

          {displayStatus.phase === 'placement-invalid' ? (
            <View style={hudStyles.invalidBanner}>
              <AppIcon name="WarningCircle" size={18} color="#ffb4a2" />
              <Text style={hudStyles.invalidText}>
                {displayStatus.invalidReason === 'anchor-removed'
                  ? 'The surface was lost, so the placement was cleared. Tap a highlighted surface to place again.'
                  : 'Tracking was not usable, so nothing was placed. Tap a highlighted surface.'}
              </Text>
            </View>
          ) : null}

          <Text style={hudStyles.controlGroupLabel}>Rotate / size</Text>
          <View style={hudStyles.controlRow}>
            <ControlButton
              label="Rotate left"
              icon="ArrowCounterClockwise"
              disabled={!adjustingEnabled}
              onPress={() => sceneApiRef.current?.rotate('left')}
            />
            <ControlButton
              label="Rotate right"
              icon="ArrowClockwise"
              disabled={!adjustingEnabled}
              onPress={() => sceneApiRef.current?.rotate('right')}
            />
          </View>
          <View style={hudStyles.controlRow}>
            <ControlButton
              label="Smaller"
              icon="ArrowsInSimple"
              disabled={!adjustingEnabled}
              onPress={() => sceneApiRef.current?.scale('smaller')}
            />
            <ControlButton
              label="Larger"
              icon="ArrowsOutSimple"
              disabled={!adjustingEnabled}
              onPress={() => sceneApiRef.current?.scale('larger')}
            />
          </View>

          <Text style={hudStyles.controlGroupLabel}>Placement</Text>
          <View style={hudStyles.controlRow}>
            <ControlButton
              label="Place again"
              icon="Crosshair"
              disabled={!adjustingEnabled && !isConfirmed}
              onPress={() => sceneApiRef.current?.placeAgain()}
            />
            {isConfirmed ? (
              <ControlButton
                label="Edit placement"
                icon="PencilSimple"
                disabled={false}
                onPress={() => sceneApiRef.current?.editPlacement()}
              />
            ) : (
              <ControlButton
                label="Confirm"
                icon="Check"
                disabled={!confirmEnabled}
                onPress={() => sceneApiRef.current?.confirm()}
                emphasis
              />
            )}
          </View>
          <View style={hudStyles.controlRow}>
            <ControlButton
              label="Reset session"
              icon="ArrowsClockwise"
              disabled={false}
              onPress={resetSession}
            />
            <ControlButton label="Back" icon="ArrowLeft" disabled={false} onPress={handleBack} />
          </View>

          <Text style={hudStyles.footnote}>
            A horizontal plane is not proof that a surface is a floor or table. Rotation, size and
            placement are kept in memory only and are never written to the app database.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function phaseColor(phase: ARPlacementStatus['phase']): string {
  switch (phase) {
    case 'confirmed':
      return '#7fd6a4';
    case 'placed':
      return '#7cc7ff';
    case 'placement-invalid':
      return '#ffb4a2';
    case 'surface-available':
      return '#ffd166';
    case 'scanning':
    default:
      return '#ffffff';
  }
}

const ControlButton: React.FC<{
  label: string;
  icon: string;
  disabled: boolean;
  onPress: () => void;
  emphasis?: boolean;
}> = ({ label, icon, disabled, onPress, emphasis }) => {
  return (
    <TouchableOpacity
      style={[
        hudStyles.controlButton,
        emphasis && hudStyles.controlButtonEmphasis,
        disabled && hudStyles.controlButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
    >
      <AppIcon name={icon} size={18} color="#ffffff" />
      <Text style={hudStyles.controlButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const hudStyles = StyleSheet.create({
  topBarWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  titleText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    maxWidth: '92%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusPillText: {
    color: '#ffffff',
    fontSize: 12,
    flexShrink: 1,
  },
  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '62%',
  },
  bottomScroll: {
    flexGrow: 0,
  },
  bottomContent: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  diagPanel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  diagTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  diagLine: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 17,
  },
  diagValue: {
    color: '#ffffff',
    fontWeight: '600',
  },
  guidance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,209,102,0.16)',
  },
  guidanceTextWrap: {
    flex: 1,
    marginHorizontal: 8,
  },
  guidanceText: {
    color: '#ffe6a8',
    fontSize: 11,
    lineHeight: 16,
  },
  guidanceButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#ffd166',
  },
  guidanceButtonText: {
    color: '#1d1f1e',
    fontSize: 12,
    fontWeight: '700',
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(127,214,164,0.18)',
    marginBottom: 10,
  },
  confirmedText: {
    color: '#d6fbe4',
    fontSize: 12,
    flex: 1,
    marginLeft: 8,
    lineHeight: 17,
  },
  invalidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,180,162,0.18)',
    marginBottom: 10,
  },
  invalidText: {
    color: '#ffe0d8',
    fontSize: 12,
    flex: 1,
    marginLeft: 8,
    lineHeight: 17,
  },
  controlGroupLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  controlButtonEmphasis: {
    backgroundColor: 'rgba(78,107,87,0.95)',
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  footnote: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    arContainer: {
      flex: 1,
      backgroundColor: '#000000',
    },
    arView: {
      flex: 1,
    },
    pausedPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: '#000000',
    },
    pausedText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 14,
      textAlign: 'center',
    },
    centerContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    terminalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 16,
      textAlign: 'center',
    },
    terminalBody: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 10,
      textAlign: 'center',
      lineHeight: 20,
    },
    terminalNote: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 18,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    terminalActions: {
      padding: 24,
      gap: 10,
    },
    terminalBackButton: {
      alignSelf: 'center',
      paddingVertical: 12,
      paddingHorizontal: 28,
      marginBottom: 28,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    terminalBackText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    primaryButton: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    secondaryButton: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default ARPlacementPOCScreen;

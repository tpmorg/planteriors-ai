import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { NetworkBanner } from '../components/NetworkBanner';
import { isLikelyNetworkError } from '../utils/networkErrorUtils';

type BannerState = 'offline' | 'degraded' | null;

interface NetworkContextType {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
  isOffline: boolean;
  isDegraded: boolean;
  reportNetworkIssue: (source: string, error?: unknown) => void;
  reportNetworkSuccess: (source?: string) => void;
}

interface NetInfoLikeState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
}

interface NetInfoLike {
  addEventListener: (listener: (state: NetInfoLikeState) => void) => () => void;
  fetch: () => Promise<NetInfoLikeState>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const OFFLINE_BANNER_DELAY_MS = 1200;
const DEGRADED_FAILURE_WINDOW_MS = 45000;
const DEGRADED_FAILURE_THRESHOLD = 2;
const DEGRADED_RECOVERY_DELAY_MS = 6000;

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

const computeIsOffline = (state: NetInfoLikeState) =>
  state.isConnected === false || state.isInternetReachable === false;

export const useNetworkGuard = () => {
  const network = useNetwork();

  return useCallback((message = 'Please check your internet connection and try again.') => {
    if (network.isOffline) {
      Alert.alert('No Connection', message);
      return false;
    }
    return true;
  }, [network.isOffline]);
};

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);
  const [bannerState, setBannerState] = useState<BannerState>(null);

  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentIssueTimestampsRef = useRef<number[]>([]);
  const currentOfflineRef = useRef(false);
  const currentDegradedRef = useRef(false);

  const clearOfflineTimer = useCallback(() => {
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
  }, []);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const activateDegraded = useCallback(() => {
    clearRecoveryTimer();
    currentDegradedRef.current = true;
    setIsDegraded(true);
    setBannerState((currentOfflineRef.current ? 'offline' : 'degraded'));
  }, [clearRecoveryTimer]);

  const clearDegraded = useCallback(() => {
    clearRecoveryTimer();
    recentIssueTimestampsRef.current = [];
    currentDegradedRef.current = false;
    setIsDegraded(false);
    setBannerState((currentOfflineRef.current ? 'offline' : null));
  }, [clearRecoveryTimer]);

  const scheduleOfflineBanner = useCallback(() => {
    clearOfflineTimer();
    offlineTimerRef.current = setTimeout(() => {
      setBannerState('offline');
    }, OFFLINE_BANNER_DELAY_MS);
  }, [clearOfflineTimer]);

  useEffect(() => {
    const getNetInfoModule = (): NetInfoLike | null => {
      try {
        const netInfoModule = require('@react-native-community/netinfo');
        return (netInfoModule?.default ?? netInfoModule) as NetInfoLike;
      } catch (error) {
        console.warn('NetInfo native module unavailable; network monitoring disabled.');
        return null;
      }
    };

    const netInfo = getNetInfoModule();
    if (!netInfo) {
      return () => {};
    }

    const applyState = (state: NetInfoLikeState) => {
      const nextOffline = computeIsOffline(state);

      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      setType(state.type);
      setIsOffline(nextOffline);
      currentOfflineRef.current = nextOffline;

      if (nextOffline) {
        clearRecoveryTimer();
        scheduleOfflineBanner();
        return;
      }

      clearOfflineTimer();
      setBannerState(currentDegradedRef.current ? 'degraded' : null);
    };

    const unsubscribe = netInfo.addEventListener((state: NetInfoLikeState) => {
      applyState(state);
    });

    netInfo.fetch().then((state) => {
      applyState(state);
    });

    return () => {
      clearOfflineTimer();
      clearRecoveryTimer();
      unsubscribe();
    };
  }, [clearOfflineTimer, clearRecoveryTimer, scheduleOfflineBanner]);

  const reportNetworkIssue = useCallback((source: string, error?: unknown) => {
    if (currentOfflineRef.current || !isLikelyNetworkError(error)) {
      return;
    }

    const now = Date.now();
    const filtered = recentIssueTimestampsRef.current.filter(
      (timestamp) => now - timestamp <= DEGRADED_FAILURE_WINDOW_MS
    );
    filtered.push(now);
    recentIssueTimestampsRef.current = filtered;

    console.log(
      `Network issue reported from ${source}; recent count=${filtered.length}`
    );

    if (filtered.length >= DEGRADED_FAILURE_THRESHOLD) {
      activateDegraded();
    }
  }, [activateDegraded]);

  const reportNetworkSuccess = useCallback((_source?: string) => {
    if (currentOfflineRef.current || !currentDegradedRef.current) {
      return;
    }

    clearRecoveryTimer();
    recoveryTimerRef.current = setTimeout(() => {
      clearDegraded();
    }, DEGRADED_RECOVERY_DELAY_MS);
  }, [clearDegraded, clearRecoveryTimer]);

  const value = useMemo<NetworkContextType>(() => ({
    isConnected,
    isInternetReachable,
    type,
    isOffline,
    isDegraded,
    reportNetworkIssue,
    reportNetworkSuccess,
  }), [
    isConnected,
    isInternetReachable,
    type,
    isOffline,
    isDegraded,
    reportNetworkIssue,
    reportNetworkSuccess,
  ]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
      {bannerState ? <NetworkBanner variant={bannerState} /> : null}
    </NetworkContext.Provider>
  );
};

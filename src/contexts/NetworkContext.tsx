import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useToast } from './ToastContext';

interface NetworkContextType {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
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

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

const isOnlineState = (state: NetworkContextType) =>
  state.isConnected !== false && state.isInternetReachable !== false;

export const useNetworkGuard = () => {
  const network = useNetwork();

  return useCallback((message = 'Please check your internet connection and try again.') => {
    if (!isOnlineState(network)) {
      Alert.alert('No Connection', message);
      return false;
    }
    return true;
  }, [network]);
};

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const { showToast } = useToast();
  const [networkState, setNetworkState] = useState<NetworkContextType>({
    isConnected: null,
    isInternetReachable: null,
    type: null,
  });
  const isFirstLoad = useRef(true);
  const previousConnected = useRef<boolean | null>(null);

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

    const applyState = (state: NetInfoLikeState, fromInitialFetch = false) => {
      const nowConnected = state.isConnected;
      const wasConnected = previousConnected.current;

      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });

      if (!isFirstLoad.current && wasConnected !== nowConnected) {
        if (nowConnected === false) {
          showToast('No internet connection', 'error', 3000);
        } else if (nowConnected === true && wasConnected === false) {
          showToast('Internet connection restored', 'success', 2000);
        }
      }

      if (fromInitialFetch && nowConnected === false) {
        showToast('You are currently offline', 'info', 3000);
      }

      previousConnected.current = nowConnected;
      isFirstLoad.current = false;
    };

    const unsubscribe = netInfo.addEventListener((state: NetInfoLikeState) => {
      applyState(state);
    });

    netInfo.fetch().then((state) => {
      applyState(state, true);
    });

    return () => {
      unsubscribe();
    };
  }, [showToast]);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
};

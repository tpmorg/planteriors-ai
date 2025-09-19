import React, { createContext, useContext, useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

interface TabBarContextType {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
  handleScroll: (event: any) => void;
  tabBarStyle: any;
  tabBarHeight: number;
}

const TabBarContext = createContext<TabBarContextType | undefined>(undefined);

export const TabBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);
  const scrollY = useSharedValue(0);
  const lastScrollY = useRef(0);
  const isScrollingDown = useRef(false);
  const insets = useSafeAreaInsets();

  const tabBarHeight = 65 + Math.max(insets.bottom, 8);

  const setTabBarVisible = (visible: boolean) => {
    setIsTabBarVisible(visible);
    scrollY.value = withTiming(visible ? 0 : 100, { duration: 200 });
  };

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.current;

    // Only trigger when scrolling more than 5 pixels
    if (Math.abs(scrollDiff) > 5) {
      const shouldHide = scrollDiff > 0 && currentScrollY > 100;
      const shouldShow = scrollDiff < 0 || currentScrollY < 50;

      if (shouldHide && isTabBarVisible) {
        setTabBarVisible(false);
        isScrollingDown.current = true;
      } else if (shouldShow && !isTabBarVisible && !isScrollingDown.current) {
        setTabBarVisible(true);
      }

      if (scrollDiff < 0) {
        isScrollingDown.current = false;
      }
    }

    lastScrollY.current = currentScrollY;
  };

  const tabBarStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 100],
      [0, 100],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY }],
    };
  });

  return (
    <TabBarContext.Provider value={{
      isTabBarVisible,
      setTabBarVisible,
      handleScroll,
      tabBarStyle,
      tabBarHeight,
    }}>
      {children}
    </TabBarContext.Provider>
  );
};

export const useTabBar = () => {
  const context = useContext(TabBarContext);
  if (context === undefined) {
    throw new Error('useTabBar must be used within a TabBarProvider');
  }
  return context;
};
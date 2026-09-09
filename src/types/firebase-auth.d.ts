import 'firebase/auth';
import type AsyncStorage from '@react-native-async-storage/async-storage';
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  /** Present in Firebase's React Native runtime export but omitted by its root type condition. */
  export function getReactNativePersistence(
    storage: typeof AsyncStorage
  ): Persistence;
}

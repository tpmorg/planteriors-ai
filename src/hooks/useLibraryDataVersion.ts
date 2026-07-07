import { useSyncExternalStore } from 'react';

import { databaseService } from '../services/databaseService';

export const useLibraryDataVersion = () =>
  useSyncExternalStore(
    (onStoreChange) => databaseService.subscribeToLibraryChanges(onStoreChange),
    () => databaseService.getLibraryChangeVersion(),
    () => databaseService.getLibraryChangeVersion()
  );

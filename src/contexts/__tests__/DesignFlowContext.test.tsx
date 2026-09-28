import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { DesignFlowProvider, useDesignFlow } from '../DesignFlowContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

it('persists the request key before reporting that generation can start', async () => {
  const { result } = renderHook(() => useDesignFlow(), {
    wrapper: ({ children }) => <DesignFlowProvider ownerId="test-user">{children}</DesignFlowProvider>,
  });
  await waitFor(() => expect(result.current.isRestoring).toBe(false));

  await act(async () => {
    await result.current.startGenerationRequest('saved-request-key');
  });

  const writes = jest.mocked(AsyncStorage.setItem).mock.calls;
  const persisted = writes.map(([, value]) => JSON.parse(value)).find((draft) => draft.requestId === 'saved-request-key');
  expect(persisted).toMatchObject({ requestStatus: 'submitting', step: 'generating' });
});

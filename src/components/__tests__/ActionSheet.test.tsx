import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ActionSheet, ActionSheetAction } from '../ActionSheet';

jest.mock('../AppIcon', () => ({
  AppIcon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{`icon:${name}`}</Text>;
  },
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      isDark: false,
      colors: {
        surface: '#fffdf9',
        text: '#1d1f1e',
        textSecondary: '#6f716f',
        border: '#e7e2d8',
        borderLight: '#f1ece3',
        destructive: '#dc2626',
        scrim: 'rgba(17,24,20,0.45)',
      },
    },
  }),
}));

const actions = (overrides: Partial<ActionSheetAction>[] = []): ActionSheetAction[] => [
  { key: 'details', label: 'Details', icon: 'Info', onPress: jest.fn() },
  { key: 'save', label: 'Save to device', icon: 'DownloadSimple', onPress: jest.fn() },
  { key: 'delete', label: 'Delete design', icon: 'Trash', destructive: true, onPress: jest.fn() },
].map((action, index) => ({ ...action, ...overrides[index] })) as ActionSheetAction[];

describe('ActionSheet', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <ActionSheet visible={false} actions={actions()} onDismiss={jest.fn()} />
    );
    expect(queryByText('Details')).toBeNull();
  });

  it('renders every action plus a cancel row', () => {
    const { getByText } = render(
      <ActionSheet visible title="Design actions" actions={actions()} onDismiss={jest.fn()} />
    );

    expect(getByText('Design actions')).toBeOnTheScreen();
    expect(getByText('Details')).toBeOnTheScreen();
    expect(getByText('Save to device')).toBeOnTheScreen();
    expect(getByText('Delete design')).toBeOnTheScreen();
    expect(getByText('Cancel')).toBeOnTheScreen();
  });

  it('fires the pressed action', () => {
    const list = actions();
    const { getByTestId } = render(
      <ActionSheet visible actions={list} onDismiss={jest.fn()} />
    );

    fireEvent.press(getByTestId('action-sheet-delete'));
    expect(list[2].onPress).toHaveBeenCalledTimes(1);
    expect(list[0].onPress).not.toHaveBeenCalled();
  });

  it('tints destructive rows with the destructive token', () => {
    const { getByText } = render(<ActionSheet visible actions={actions()} onDismiss={jest.fn()} />);

    expect(getByText('Delete design')).toHaveStyle({ color: '#dc2626' });
    expect(getByText('Details')).toHaveStyle({ color: '#1d1f1e' });
  });

  it('dismisses from the cancel row', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <ActionSheet visible actions={actions()} onDismiss={onDismiss} />
    );

    fireEvent.press(getByText('Cancel'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('blocks presses on loading rows', () => {
    const list = actions([{}, { loading: true }]);
    const { getByTestId, queryByText } = render(
      <ActionSheet visible actions={list} onDismiss={jest.fn()} />
    );

    const saveRow = getByTestId('action-sheet-save');
    expect(saveRow).toBeDisabled();
    expect(queryByText(/icon:Hourglass/)).toBeOnTheScreen();

    fireEvent.press(saveRow);
    expect(list[1].onPress).not.toHaveBeenCalled();
  });

  it('honours a custom cancel label', () => {
    const { getByText, queryByText } = render(
      <ActionSheet visible actions={actions()} onDismiss={jest.fn()} cancelLabel="Never mind" />
    );

    expect(getByText('Never mind')).toBeOnTheScreen();
    expect(queryByText('Cancel')).toBeNull();
  });
});

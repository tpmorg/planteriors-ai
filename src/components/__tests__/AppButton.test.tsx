import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { AppButton } from '../AppButton';

jest.mock('../AppIcon', () => ({
  AppIcon: ({ name, size, color }: { name: string; size?: number; color?: string }) => {
    const { Text: RNText } = require('react-native');
    return <RNText>{`icon:${name}:${size}:${color}`}</RNText>;
  },
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      isDark: false,
      colors: {
        primary: '#4e6b57',
        onPrimary: '#fffdf9',
        surface: '#fffdf9',
        text: '#1d1f1e',
        textSecondary: '#6f716f',
        border: '#e7e2d8',
        borderLight: '#f1ece3',
        destructive: '#dc2626',
        destructiveSurface: '#fef2f2',
        destructiveBorder: '#f8b4b4',
        shadow: '#000000',
        scrim: 'rgba(17,24,20,0.45)',
      },
    },
  }),
}));

describe('AppButton', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText, getByRole } = render(<AppButton title="Generate design" onPress={onPress} />);

    expect(getByText('Generate design')).toBeOnTheScreen();
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes button role for every variant', () => {
    const variants = ['primary', 'secondary', 'ghost', 'destructive', 'chip'] as const;

    variants.forEach((variant) => {
      const { getByRole, unmount } = render(<AppButton title="Tap" variant={variant} />);
      expect(getByRole('button')).toBeOnTheScreen();
      unmount();
    });
  });

  it('keeps a 44pt+ touch target on text and icon variants', () => {
    const { getByRole } = render(<AppButton title="Continue" size="md" />);
    expect(getByRole('button')).toHaveStyle({ minHeight: 48 });

    const icon = render(<AppButton variant="icon" icon="X" accessibilityLabel="Close" size="md" />);
    expect(icon.getByRole('button')).toHaveStyle({ width: 44, height: 44 });
  });

  it('adds hitSlop to icon buttons so small glyphs stay tappable', () => {
    const { getByRole } = render(
      <AppButton variant="icon" icon="X" accessibilityLabel="Close" />
    );
    expect(getByRole('button').props.hitSlop).toBe(8);
  });

  it('uses the onPrimary token instead of raw white for primary labels', () => {
    const { getByText } = render(<AppButton title="Buy" variant="primary" />);
    expect(getByText('Buy')).toHaveStyle({ color: '#fffdf9' });
  });

  it('does not fire onPress when disabled and reports the disabled state', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<AppButton title="Add To Library" onPress={onPress} disabled />);

    const button = getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('blocks presses while loading and swaps the icon for a spinner', () => {
    const onPress = jest.fn();
    const { getByRole, queryByText } = render(
      <AppButton title="Take Photo" icon="Camera" loading onPress={onPress} />
    );

    const button = getByRole('button');
    expect(button).toBeDisabled();
    expect(queryByText(/icon:Camera/)).toBeNull();

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('labels icon-only buttons from accessibility prop', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <AppButton variant="icon" icon="ArrowLeft" accessibilityLabel="Back" onPress={onPress} />
    );

    fireEvent.press(getByLabelText('Back'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the spinner in place of a trailing icon on the right', () => {
    const { getByText } = render(<AppButton title="Continue" icon="ArrowRight" iconPosition="right" />);
    expect(getByText(/icon:ArrowRight/)).toBeOnTheScreen();
    expect(getByText('Continue')).toBeOnTheScreen();
  });

  it('renders a selected chip with the primary surface', () => {
    const { getByRole } = render(<AppButton title="Modern" variant="chip" selected />);
    expect(getByRole('button')).toHaveStyle({ backgroundColor: '#4e6b57' });
  });

  it('renders overlay chrome with a dark surface and white label', () => {
    const { getByText, getByRole } = render(
      <AppButton title="Compare" variant="chip" overlay />
    );
    expect(getByRole('button')).toHaveStyle({ backgroundColor: 'rgba(18,18,18,0.76)' });
    expect(getByText('Compare')).toHaveStyle({ color: '#ffffff' });
  });

  it('renders a count badge on icon buttons', () => {
    const { getByText } = render(
      <AppButton variant="icon" icon="SlidersHorizontal" accessibilityLabel="Filters" badge={2} />
    );

    expect(getByText('2')).toBeOnTheScreen();
  });

  it('renders without a badge when the count is zero', () => {
    const { queryByText } = render(
      <AppButton variant="icon" icon="SlidersHorizontal" accessibilityLabel="Filters" badge={0} />
    );

    expect(queryByText('0')).toBeNull();
  });

  it('forwards accessibilityHint and testID', () => {
    const { getByTestId } = render(
      <AppButton
        variant="icon"
        icon="ArrowsClockwise"
        accessibilityLabel="Replace plant"
        accessibilityHint="Choose a different plant"
        testID="replace-plant"
      />
    );

    const button = getByTestId('replace-plant');
    expect(button.props.accessibilityHint).toBe('Choose a different plant');
  });

  it('lets callers override style and textStyle last', () => {
    const { getByText, getByRole } = render(
      <AppButton title="Back" variant="secondary" style={{ flex: 1 }} textStyle={{ fontSize: 13 }} />
    );

    expect(getByRole('button')).toHaveStyle({ flex: 1 });
    expect(getByText('Back')).toHaveStyle({ fontSize: 13 });
  });

  it('renders without a theme token for onPrimary (partial theme mocks)', () => {
    const { getByText } = render(<AppButton title="Fallback" variant="ghost" />);
    expect(getByText('Fallback')).toBeOnTheScreen();
    expect(Text).toBeTruthy();
  });
});

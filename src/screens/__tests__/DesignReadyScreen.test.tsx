import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { DesignReadyScreen } from '../DesignReadyScreen';
import { buildGenerationRequest, createDesignDraft } from '../../designFlow/designFlow';
import type { DesignFlowDraft } from '../../types';

jest.mock('../../components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: { colors: {
    primary: '#257047', text: '#111111', textSecondary: '#555555', background: '#ffffff',
    surface: '#f8f8f8', border: '#dddddd', borderLight: '#eeeeee',
  } } }),
}));

const noop = () => {};

function Harness({ onGenerate = jest.fn() }: { onGenerate?: jest.Mock }) {
  const [draft, setDraft] = useState<DesignFlowDraft>(() => ({ ...createDesignDraft('test-user'),
    intent: 'restyle' as const,
    photo: { originalUri: 'file://room.jpg', preparedUri: 'file://prepared.jpg', width: 1000, height: 800, revision: 1 },
  }));
  return <DesignReadyScreen draft={draft} updateDraft={(patch) => setDraft((value) => ({ ...value, ...patch }))}
    onGenerate={() => onGenerate(buildGenerationRequest(draft))} allowanceText="5 design credits available"
    onBack={noop} onClose={noop} onCustomize={noop} onChooseSpot={noop} onChangeTarget={noop} onReplacePhoto={noop} onCropPhoto={noop} />;
}

it('edits Restyle directly with only style, amount, and instructions', () => {
  const onGenerate = jest.fn();
  const screen = render(<Harness onGenerate={onGenerate} />);
  expect(screen.queryByText('Customize')).toBeNull();
  expect(screen.queryByText('Pot style')).toBeNull();
  expect(screen.queryByText('Care level')).toBeNull();
  expect(screen.getByRole('radio', { name: 'Style: Japandi', checked: true })).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Style: Mid-century'));
  fireEvent.press(screen.getByLabelText('Amount: Generous'));
  fireEvent.changeText(screen.getByLabelText('Special instructions'), 'Keep the sofa');
  fireEvent.press(screen.getByText('Generate design'));
  expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({
    mode: 'multi-plant', restyle: { styleId: 'mid-century', amount: 'generous' },
    plantType: expect.objectContaining({ name: 'Mid-century' }), prompt: 'Keep the sofa',
  }));
});

it('shows the scroll cue only when content remains below, including after a viewport resize', () => {
  const screen = render(<Harness />);
  const scroll = screen.UNSAFE_getByType(ScrollView);
  fireEvent(scroll, 'layout', { nativeEvent: { layout: { height: 500 } } });
  fireEvent(scroll, 'contentSizeChange', 360, 1500);
  expect(screen.getByLabelText('More below. Scroll down')).toBeTruthy();
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
  fireEvent.press(screen.getByLabelText('More below. Scroll down'));
  expect(scrollTo).toHaveBeenCalledWith({ y: 375, animated: true });
  scrollTo.mockRestore();
  fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 1000 } } });
  expect(screen.queryByText('More below')).toBeNull();
  fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 100 } } });
  expect(screen.getByText('More below')).toBeTruthy();
  fireEvent(scroll, 'layout', { nativeEvent: { layout: { height: 1600 } } });
  expect(screen.queryByText('More below')).toBeNull();
  fireEvent(scroll, 'contentSizeChange', 360, 2500);
  expect(screen.getByText('More below')).toBeTruthy();
});

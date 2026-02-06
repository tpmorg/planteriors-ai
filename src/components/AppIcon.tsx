import React from 'react';
import * as PhosphorIcons from 'phosphor-react-native';

type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  weight?: IconWeight;
  style?: any;
}

const FALLBACK_ICON =
  (PhosphorIcons as any).Leaf ||
  (PhosphorIcons as any).Plant ||
  (PhosphorIcons as any).Circle;

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 24,
  color,
  weight = 'regular',
  style,
}) => {
  const Icon = (PhosphorIcons as any)[name] || FALLBACK_ICON;

  if (!Icon) {
    return null;
  }

  return <Icon size={size} color={color} weight={weight} style={style} />;
};

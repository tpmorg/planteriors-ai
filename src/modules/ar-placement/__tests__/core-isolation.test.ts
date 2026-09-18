import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN = [
  'react-native',
  '@reactvision/react-viro',
  'expo',
  '@react-navigation',
  'firebase',
  'expo-file-system',
  'expo-sharing',
  'expo-camera',
];

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return fs.statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('core isolation', () => {
  it('does not import React Native, Viro, Expo, navigation, or network libraries', () => {
    const root = path.join(__dirname, '..', 'core');
    const files = walk(root).filter((file) => file.endsWith('.ts'));
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const token of FORBIDDEN) {
        if (source.includes(`from '${token}`) || source.includes(`from "${token}`)) {
          offenders.push(`${path.basename(file)} → ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

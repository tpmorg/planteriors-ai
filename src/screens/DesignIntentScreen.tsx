import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignFlowShell } from '../components/DesignFlowShell';
import { AppIcon } from '../components/AppIcon';
import { useTheme } from '../contexts/ThemeContext';
import type { DesignIntent } from '../types';

const CHOICES: Array<{ id: DesignIntent; title: string; description: string; icon: string }> = [
  { id: 'restyle', title: 'Restyle room', description: 'Create a coordinated arrangement of plants', icon: 'Plant' },
  { id: 'add', title: 'Add a plant', description: 'See a particular plant in this room', icon: 'Plus' },
  { id: 'replace', title: 'Replace a plant', description: 'Swap a plant that is already there', icon: 'ArrowsClockwise' },
];

export function DesignIntentScreen({ imageUri, onSelect, onBack, onClose }: {
  imageUri: string;
  onSelect: (intent: DesignIntent) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return (
    <DesignFlowShell title="What would you like to do?" onBack={onBack} onClose={onClose}>
      <Image source={{ uri: imageUri }} style={styles.photo as any} resizeMode="cover" />
      <View style={styles.choices}>
        {CHOICES.map((choice) => (
          <Pressable
            key={choice.id}
            style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
            onPress={() => onSelect(choice.id)}
            accessibilityRole="button"
            accessibilityLabel={choice.title}
            accessibilityHint={choice.description}
          >
            <View style={styles.icon}><AppIcon name={choice.icon} size={23} color={theme.colors.primary} /></View>
            <View style={styles.copy}>
              <Text style={styles.choiceTitle}>{choice.title}</Text>
              <Text style={styles.choiceDescription}>{choice.description}</Text>
            </View>
            <AppIcon name="ArrowRight" size={19} color={theme.colors.textSecondary} />
          </Pressable>
        ))}
      </View>
    </DesignFlowShell>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  photo: { width: '100%', height: 210, borderRadius: 20, backgroundColor: theme.colors.borderLight, marginTop: 12 },
  choices: { marginTop: 18, gap: 12 },
  choice: { minHeight: 82, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', padding: 14 },
  choicePressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.borderLight },
  copy: { flex: 1, marginHorizontal: 13 },
  choiceTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  choiceDescription: { marginTop: 3, fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary },
});

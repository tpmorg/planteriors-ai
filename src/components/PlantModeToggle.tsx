import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppIcon } from './AppIcon';
import { PlantSelectionMode } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface PlantModeToggleProps {
  mode: PlantSelectionMode;
  onModeChange: (mode: PlantSelectionMode) => void;
}

export const PlantModeToggle: React.FC<PlantModeToggleProps> = ({
  mode,
  onModeChange,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const hintText =
    mode === 'multi-plant'
      ? 'Fill your space with a curated plant arrangement'
      : mode === 'replace-plant'
        ? 'Swap a current plant for a new alternative'
        : 'Place a specific plant in your room';

  return (
    <View style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            mode === 'multi-plant' && styles.toggleButtonActive,
          ]}
          onPress={() => onModeChange('multi-plant')}
          activeOpacity={0.7}
        >
          <AppIcon
            name="SquaresFour"
            size={18}
            color={mode === 'multi-plant' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              mode === 'multi-plant' && styles.toggleTextActive,
            ]}
          >
            Style
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            mode === 'individual' && styles.toggleButtonActive,
          ]}
          onPress={() => onModeChange('individual')}
          activeOpacity={0.7}
        >
          <AppIcon
            name="Flower"
            size={18}
            color={mode === 'individual' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              mode === 'individual' && styles.toggleTextActive,
            ]}
          >
            Add
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            mode === 'replace-plant' && styles.toggleButtonActive,
          ]}
          onPress={() => onModeChange('replace-plant')}
          activeOpacity={0.7}
        >
          <AppIcon
            name="ArrowsClockwise"
            size={18}
            color={mode === 'replace-plant' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              mode === 'replace-plant' && styles.toggleTextActive,
            ]}
          >
            Replace
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>{hintText}</Text>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.borderLight,
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
});

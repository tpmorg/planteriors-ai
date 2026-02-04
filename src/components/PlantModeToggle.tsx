import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Layers, Flower2 } from 'lucide-react-native';
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
          <Layers
            size={18}
            color={mode === 'multi-plant' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              mode === 'multi-plant' && styles.toggleTextActive,
            ]}
          >
            Multi-Plant Style
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
          <Flower2
            size={18}
            color={mode === 'individual' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              mode === 'individual' && styles.toggleTextActive,
            ]}
          >
            Individual Plant
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        {mode === 'multi-plant'
          ? 'Fill your space with a curated plant arrangement'
          : 'Place a specific plant in your room'}
      </Text>
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
    paddingHorizontal: 12,
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
    fontSize: 13,
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

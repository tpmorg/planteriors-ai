import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Layers, Flower2 } from 'lucide-react-native';
import { PlantSelectionMode } from '../types';

interface PlantModeToggleProps {
  mode: PlantSelectionMode;
  onModeChange: (mode: PlantSelectionMode) => void;
}

export const PlantModeToggle: React.FC<PlantModeToggleProps> = ({
  mode,
  onModeChange,
}) => {
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
            color={mode === 'multi-plant' ? '#2d5016' : '#6b7280'}
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
            color={mode === 'individual' ? '#2d5016' : '#6b7280'}
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
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
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#2d5016',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 10,
  },
});

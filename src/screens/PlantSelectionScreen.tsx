import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PlantType, PlantStyle } from '../types';

interface PlantSelectionScreenProps {
  imageUri: string;
  onPlantSelected: (plantType: PlantType, plantStyle: PlantStyle) => void;
  onBack: () => void;
}

const PLANT_TYPES: PlantType[] = [
  {
    id: 'succulents',
    name: 'Succulents',
    description: 'Low-maintenance, water-storing plants',
    icon: '🌵',
    styles: [
      { id: 'modern', name: 'Modern', description: 'Clean, geometric arrangements', icon: '⚡' },
      { id: 'rustic', name: 'Rustic', description: 'Natural, organic feel', icon: '🪵' },
      { id: 'minimalist', name: 'Minimalist', description: 'Simple, elegant displays', icon: '⭕' },
    ],
  },
  {
    id: 'tropical',
    name: 'Tropical Plants',
    description: 'Lush, green foliage plants',
    icon: '🌿',
    styles: [
      { id: 'jungle', name: 'Jungle', description: 'Dense, wild arrangements', icon: '🌴' },
      { id: 'contemporary', name: 'Contemporary', description: 'Stylish, curated look', icon: '✨' },
      { id: 'bohemian', name: 'Bohemian', description: 'Eclectic, artistic vibe', icon: '🎨' },
    ],
  },
  {
    id: 'flowering',
    name: 'Flowering Plants',
    description: 'Colorful blooms and flowers',
    icon: '🌸',
    styles: [
      { id: 'cottage', name: 'Cottage', description: 'Charming, homey feel', icon: '🏡' },
      { id: 'elegant', name: 'Elegant', description: 'Sophisticated arrangements', icon: '👑' },
      { id: 'vibrant', name: 'Vibrant', description: 'Bold, colorful displays', icon: '🌈' },
    ],
  },
  {
    id: 'hanging',
    name: 'Hanging Plants',
    description: 'Trailing and cascading plants',
    icon: '🪴',
    styles: [
      { id: 'cascading', name: 'Cascading', description: 'Flowing, waterfall effect', icon: '💧' },
      { id: 'structured', name: 'Structured', description: 'Organized, planned layout', icon: '📐' },
      { id: 'natural', name: 'Natural', description: 'Organic, free-flowing', icon: '🍃' },
    ],
  },
];

export const PlantSelectionScreen: React.FC<PlantSelectionScreenProps> = ({
  imageUri,
  onPlantSelected,
  onBack,
}) => {
  const [selectedPlantType, setSelectedPlantType] = useState<PlantType | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<PlantStyle | null>(null);

  const handlePlantTypeSelect = (plantType: PlantType) => {
    setSelectedPlantType(plantType);
    setSelectedStyle(null);
  };

  const handleStyleSelect = (style: PlantStyle) => {
    setSelectedStyle(style);
  };

  const handleContinue = () => {
    if (selectedPlantType && selectedStyle) {
      onPlantSelected(selectedPlantType, selectedStyle);
    }
  };

  const renderPlantTypeCard = (plantType: PlantType) => (
    <TouchableOpacity
      key={plantType.id}
      style={[
        styles.plantCard,
        selectedPlantType?.id === plantType.id && styles.selectedCard,
      ]}
      onPress={() => handlePlantTypeSelect(plantType)}
    >
      <Text style={styles.plantIcon}>{plantType.icon}</Text>
      <Text style={styles.plantName}>{plantType.name}</Text>
      <Text style={styles.plantDescription}>{plantType.description}</Text>
    </TouchableOpacity>
  );

  const renderStyleCard = (style: PlantStyle) => (
    <TouchableOpacity
      key={style.id}
      style={[
        styles.styleCard,
        selectedStyle?.id === style.id && styles.selectedCard,
      ]}
      onPress={() => handleStyleSelect(style)}
    >
      <Text style={styles.styleIcon}>{style.icon}</Text>
      <Text style={styles.styleName}>{style.name}</Text>
      <Text style={styles.styleDescription}>{style.description}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2d5016" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plants</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.imagePreview}>
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
        <View style={styles.imageOverlay}>
          <Text style={styles.imageText}>Your Room</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Step 1: Select Plant Type {selectedPlantType && '✓'}
          </Text>
          <View style={styles.plantGrid}>
            {PLANT_TYPES.map(renderPlantTypeCard)}
          </View>
        </View>

        {selectedPlantType && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Step 2: Choose Style {selectedStyle && '✓'}
            </Text>
            <View style={styles.styleGrid}>
              {selectedPlantType.styles.map(renderStyleCard)}
            </View>
          </View>
        )}

        {selectedPlantType && selectedStyle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selection Summary</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>
                <Text style={styles.summaryLabel}>Plant Type: </Text>
                {selectedPlantType.name}
              </Text>
              <Text style={styles.summaryText}>
                <Text style={styles.summaryLabel}>Style: </Text>
                {selectedStyle.name}
              </Text>
              <Text style={styles.summaryDescription}>
                Your room will be enhanced with {selectedPlantType.name.toLowerCase()} in a{' '}
                {selectedStyle.name.toLowerCase()} style.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {selectedPlantType && selectedStyle && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Generate Plant Design</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d5016',
  },
  placeholder: {
    width: 40,
  },
  imagePreview: {
    height: 120,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
  },
  imageText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d5016',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  plantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  plantCard: {
    width: '48%',
    backgroundColor: 'white',
    margin: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: '#2d5016',
    backgroundColor: '#f0f7e8',
  },
  plantIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  plantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d5016',
    marginBottom: 4,
  },
  plantDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  styleGrid: {
    paddingHorizontal: 8,
  },
  styleCard: {
    backgroundColor: 'white',
    marginHorizontal: 8,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  styleIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  styleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d5016',
    flex: 1,
  },
  styleDescription: {
    fontSize: 12,
    color: '#6b7280',
    flex: 2,
  },
  summaryCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d5016',
  },
  summaryText: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryLabel: {
    fontWeight: '600',
    color: '#2d5016',
  },
  summaryDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  continueButton: {
    backgroundColor: '#2d5016',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});
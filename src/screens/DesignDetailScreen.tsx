import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { SavedDesign } from '../types';
import { databaseService } from '../services/databaseService';

interface DesignDetailScreenProps {
  design: SavedDesign;
  onBack: () => void;
  onDesignDeleted: () => void;
}

export const DesignDetailScreen: React.FC<DesignDetailScreenProps> = ({
  design: initialDesign,
  onBack,
  onDesignDeleted,
}) => {
  const [design, setDesign] = useState<SavedDesign>(initialDesign);
  const [isSharing, setIsSharing] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getImageUri = () => {
    return design.localImagePath || design.generatedImageUri;
  };

  const toggleFavorite = async () => {
    try {
      await databaseService.toggleFavorite(design.id);
      setDesign(prev => ({
        ...prev,
        isFavorite: !prev.isFavorite,
      }));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const deleteDesign = () => {
    Alert.alert(
      'Delete Design',
      'Are you sure you want to delete this design? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deleteDesign(design.id);
              onDesignDeleted();
            } catch (error) {
              console.error('Failed to delete design:', error);
              Alert.alert('Error', 'Failed to delete design');
            }
          },
        },
      ]
    );
  };

  const shareDesign = async () => {
    if (isSharing) return;

    setIsSharing(true);
    try {
      const imageUri = getImageUri();

      if (imageUri.startsWith('data:')) {
        // For data URIs, we need to save to a temporary file first
        const fileName = `plant_design_${design.id}.png`;
        const tempPath = `${FileSystem.cacheDirectory}${fileName}`;

        const base64Data = imageUri.split(',')[1];
        await FileSystem.writeAsStringAsync(tempPath, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tempPath, {
            mimeType: 'image/png',
            dialogTitle: 'Share Plant Design',
          });
        } else {
          // Fallback to React Native Share for text
          await Share.share({
            message: `Check out my plant design! Created with ${design.plantType.name} in ${design.plantStyle.name} style.`,
            title: 'Plant Interior Design',
          });
        }
      } else if (imageUri.startsWith('file://') || design.localImagePath) {
        // For local files
        const filePath = design.localImagePath || imageUri;
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'image/png',
            dialogTitle: 'Share Plant Design',
          });
        }
      } else {
        // For URLs, fallback to text sharing
        await Share.share({
          message: `Check out my plant design! Created with ${design.plantType.name} in ${design.plantStyle.name} style.`,
          url: imageUri,
          title: 'Plant Interior Design',
        });
      }
    } catch (error) {
      console.error('Failed to share design:', error);
      Alert.alert('Error', 'Failed to share design');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={toggleFavorite}
            style={styles.headerButton}
          >
            <Ionicons
              name={design.isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={design.isFavorite ? '#dc2626' : 'white'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={shareDesign}
            style={styles.headerButton}
            disabled={isSharing}
          >
            <Ionicons
              name={isSharing ? 'hourglass-outline' : 'share-outline'}
              size={24}
              color="white"
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={deleteDesign} style={styles.headerButton}>
            <Ionicons name="trash-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: getImageUri() }}
            style={styles.designImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.titleSection}>
            <Text style={styles.plantTypeTitle}>{design.plantType.name}</Text>
            <Text style={styles.plantStyleSubtitle}>
              {design.plantStyle.name} Style
            </Text>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Ionicons name="leaf-outline" size={20} color="#2d5016" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Plant Type</Text>
                <Text style={styles.infoValue}>{design.plantType.name}</Text>
                <Text style={styles.infoDescription}>
                  {design.plantType.description}
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Ionicons name="color-palette-outline" size={20} color="#2d5016" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Style</Text>
                <Text style={styles.infoValue}>{design.plantStyle.name}</Text>
                <Text style={styles.infoDescription}>
                  {design.plantStyle.description}
                </Text>
              </View>
            </View>

            {design.customPrompt && (
              <View style={styles.infoItem}>
                <Ionicons name="chatbox-outline" size={20} color="#2d5016" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Custom Requirements</Text>
                  <Text style={styles.infoDescription}>
                    {design.customPrompt}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color="#2d5016" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>
                  {formatDate(design.createdAt)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    height: 400,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  designImage: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  plantTypeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d5016',
    textAlign: 'center',
  },
  plantStyleSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  infoSection: {
    gap: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d5016',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
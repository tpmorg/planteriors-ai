import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface PaywallModalProps {
  visible: boolean;
  onUpgrade: () => void;
  onDismiss: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onUpgrade,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <BlurView intensity={theme.isDark ? 60 : 40} style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <View style={styles.handle} />

              <View style={styles.content}>
                <View style={styles.iconContainer}>
                  <Ionicons name="lock-closed" size={48} color={theme.colors.primary} />
                </View>

                <Text style={styles.title}>You've Reached Your Limit!</Text>

                <Text style={styles.description}>
                  You've used all 5 free generations. Upgrade to Premium to continue creating
                  beautiful plant-enhanced designs.
                </Text>

                <View style={styles.featuresList}>
                  <Feature
                    icon="infinite"
                    text="Unlimited AI generations"
                    theme={theme}
                  />
                  <Feature
                    icon="flash"
                    text="Priority processing"
                    theme={theme}
                  />
                  <Feature
                    icon="image"
                    text="HD exports"
                    theme={theme}
                  />
                  <Feature
                    icon="folder"
                    text="Save unlimited designs"
                    theme={theme}
                  />
                </View>

                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={onUpgrade}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sparkles" size={20} color={theme.colors.surface} />
                  <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={onDismiss}
                  activeOpacity={0.6}
                >
                  <Text style={styles.dismissButtonText}>Maybe Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </BlurView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

interface FeatureProps {
  icon: string;
  text: string;
  theme: any;
}

const Feature: React.FC<FeatureProps> = ({ icon, text, theme }) => {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.isDark ? theme.colors.surface : '#f0fdf4',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon as any} size={18} color={theme.colors.primary} />
      </View>
      <Text
        style={{
          fontSize: 15,
          color: theme.colors.text,
          flex: 1,
        }}
      >
        {text}
      </Text>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalContainer: {
      height: SCREEN_HEIGHT * 0.7,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 8,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.isDark ? theme.colors.card : '#f0fdf4',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    featuresList: {
      gap: 16,
      marginBottom: 32,
    },
    upgradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    upgradeButtonText: {
      fontSize: 17,
      fontWeight: 'bold',
      color: theme.colors.surface,
    },
    dismissButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    dismissButtonText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
  });

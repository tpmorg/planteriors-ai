import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { AppButton } from './AppButton';
import { AppIcon } from './AppIcon';
import { useTheme } from '../contexts/ThemeContext';
import { FREE_GENERATION_LIMIT } from '../services/usageTrackingService';

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
                  <AppIcon name="Lock" size={48} color={theme.colors.primary} />
                </View>

                <Text style={styles.title}>You've Reached Your Limit!</Text>

                <Text style={styles.description}>
                  You've used all {FREE_GENERATION_LIMIT} free generations. Choose a monthly plan
                  with 30 designs or a one-time pack of 20 designs to keep creating.
                </Text>

                <View style={styles.featuresList}>
                  <Feature
                    icon="Calendar"
                    text="$4.99 monthly for 30 designs"
                    theme={theme}
                  />
                  <Feature
                    icon="Package"
                    text="$4.99 for 20 one-time designs"
                    theme={theme}
                  />
                  <Feature
                    icon="Clock"
                    text="Room Pack credits never expire"
                    theme={theme}
                  />
                  <Feature
                    icon="CheckCircle"
                    text="Choose the option that fits your project"
                    theme={theme}
                  />
                </View>

                <AppButton
                  variant="primary"
                  size="lg"
                  elevated
                  icon="CreditCard"
                  title="View Design Options"
                  onPress={onUpgrade}
                  style={styles.upgradeButton}
                  testID="paywall-upgrade"
                />

                <AppButton
                  variant="ghost"
                  title="Maybe Later"
                  onPress={onDismiss}
                  textStyle={styles.dismissButtonText}
                  testID="paywall-dismiss"
                />
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
        <AppIcon name={icon} size={18} color={theme.colors.primary} />
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
      marginBottom: 12,
    },
    dismissButtonText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
  });

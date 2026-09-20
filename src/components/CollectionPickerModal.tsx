import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { AppIcon } from './AppIcon';
import { AppButton } from './AppButton';
import { Collection } from '../types';

interface CollectionPickerModalProps {
  visible: boolean;
  collections: Collection[];
  selectedCollectionId?: string | null;
  title?: string;
  allowNone?: boolean;
  noneLabel?: string;
  noneIcon?: string;
  onSelect: (collectionId: string | null) => void;
  onCreate: (name: string) => Promise<void> | void;
  onDismiss: () => void;
}

export const CollectionPickerModal: React.FC<CollectionPickerModalProps> = ({
  visible,
  collections,
  selectedCollectionId = null,
  title = 'Collections',
  allowNone = true,
  noneLabel = 'No Collection',
  noneIcon = 'Prohibit',
  onSelect,
  onCreate,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inputRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName('');
      setIsCreating(false);
      return;
    }
    if (isCreating) {
      const timer = setTimeout(() => inputRef.current?.focus(), 140);
      return () => clearTimeout(timer);
    }
  }, [visible, isCreating]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed);
    setName('');
    setIsCreating(false);
    Keyboard.dismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={[styles.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardContainer}
            >
              <View style={styles.dialog}>
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <AppButton
                    variant="icon"
                    size="sm"
                    icon="X"
                    onPress={onDismiss}
                    accessibilityLabel="Close collections"
                  />
                </View>

                {!isCreating && (
                  <View style={styles.createRow}>
                    <AppButton
                      variant="secondary"
                      size="md"
                      icon="FolderPlus"
                      title="Add Collection"
                      onPress={() => setIsCreating(true)}
                      style={styles.newCollectionButton}
                    />
                  </View>
                )}

                {isCreating && (
                  <View style={styles.createComposer}>
                    <View style={styles.inputWrap}>
                      <TextInput
                        ref={inputRef}
                        value={name}
                        onChangeText={setName}
                        placeholder="Collection name"
                        placeholderTextColor={theme.colors.textSecondary}
                        style={styles.input}
                        returnKeyType="done"
                        onSubmitEditing={handleCreate}
                        autoCorrect={false}
                        autoCapitalize="words"
                      />
                    </View>
                    <View style={styles.composerActions}>
                      <AppButton
                        variant="ghost"
                        size="sm"
                        title="Cancel"
                        onPress={() => {
                          setIsCreating(false);
                          setName('');
                          Keyboard.dismiss();
                        }}
                      />
                      <AppButton
                        variant="primary"
                        size="sm"
                        icon="Check"
                        title="Create"
                        disabled={!name.trim()}
                        onPress={handleCreate}
                      />
                    </View>
                  </View>
                )}

                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {allowNone && (
                    <Row
                      label={noneLabel}
                      icon={noneIcon}
                      isSelected={!selectedCollectionId}
                      onPress={() => onSelect(null)}
                      theme={theme}
                    />
                  )}

                  {collections.map((c) => (
                    <Row
                      key={c.id}
                      label={c.name}
                      icon="Folder"
                      isSelected={selectedCollectionId === c.id}
                      onPress={() => onSelect(c.id)}
                      theme={theme}
                    />
                  ))}
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const Row: React.FC<{
  label: string;
  icon: string;
  isSelected: boolean;
  onPress: () => void;
  theme: any;
}> = ({ label, icon, isSelected, onPress, theme }) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: isSelected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 48,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
        backgroundColor: theme.colors.card,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
        }}
      >
        <AppIcon name={icon} size={18} color={isSelected ? theme.colors.surface : theme.colors.text} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isSelected && <AppIcon name="Check" size={18} color={theme.colors.primary} />}
    </Pressable>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
      paddingHorizontal: 18,
    },
    keyboardContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dialog: {
      width: '100%',
      maxWidth: 560,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      maxHeight: '82%',
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 12,
    },
    header: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    createRow: {
      paddingHorizontal: 18,
      paddingBottom: 10,
    },
    newCollectionButton: {
      width: '100%',
    },
    createComposer: {
      paddingHorizontal: 18,
      paddingBottom: 12,
      gap: 10,
    },
    inputWrap: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    input: {
      fontSize: 16,
      color: theme.colors.text,
    },
    composerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 10,
    },
    list: {
      paddingHorizontal: 18,
    },
    listContent: {
      gap: 10,
      paddingBottom: 16,
    },
  });

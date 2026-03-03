import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
                  <TouchableOpacity onPress={onDismiss} hitSlop={10}>
                    <AppIcon name="X" size={22} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                {!isCreating && (
                  <View style={styles.createRow}>
                    <TouchableOpacity
                      style={styles.newCollectionButton}
                      onPress={() => setIsCreating(true)}
                      activeOpacity={0.85}
                    >
                      <AppIcon name="FolderPlus" size={18} color={theme.colors.primary} />
                      <Text style={styles.newCollectionButtonText}>Add Collection</Text>
                    </TouchableOpacity>
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
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setIsCreating(false);
                          setName('');
                          Keyboard.dismiss();
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
                        onPress={handleCreate}
                        disabled={!name.trim()}
                        activeOpacity={0.85}
                      >
                        <AppIcon name="Check" size={16} color={theme.colors.surface} />
                        <Text style={styles.createButtonText}>Create</Text>
                      </TouchableOpacity>
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
        backgroundColor: theme.colors.card,
      }}
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
    </TouchableOpacity>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingVertical: 12,
    },
    newCollectionButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.primary,
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
    cancelButton: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    createButton: {
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      flexDirection: 'row',
      gap: 6,
    },
    createButtonDisabled: {
      opacity: 0.5,
    },
    createButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.surface,
    },
    list: {
      paddingHorizontal: 18,
    },
    listContent: {
      gap: 10,
      paddingBottom: 16,
    },
  });

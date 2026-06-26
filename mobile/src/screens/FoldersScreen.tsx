import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar, Platform, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useFolders, useUnreadCounts, useEmailAddresses, folderLabel } from '../hooks/useEmails';
import { colors } from '../lib/colors';
import { RootStackParamList, Folder } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Same folder icon map as InboxScreen drawer and EmailSidebar
const FOLDER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  inbox:   'mail-outline',
  sent:    'paper-plane-outline',
  drafts:  'create-outline',
  spam:    'warning-outline',
  trash:   'trash-outline',
  starred: 'star-outline',
  archive: 'archive-outline',
  snoozed: 'time-outline',
};
function getFolderIcon(folder: Folder): keyof typeof Ionicons.glyphMap {
  return FOLDER_ICON[folder.type] || FOLDER_ICON[folder.icon] || 'folder-outline';
}

const FOLDER_COLOR: Record<string, string> = {
  inbox:   colors.primary,
  sent:    '#34A853',
  drafts:  '#9C27B0',
  spam:    '#FF6D00',
  trash:   '#5F6368',
  starred: '#FBBC04',
  archive: '#00BCD4',
  snoozed: '#E91E63',
};
const FOLDER_BG: Record<string, string> = {
  inbox:   colors.primaryLight,
  sent:    '#E6F4EA',
  drafts:  '#F3E5F5',
  spam:    '#FFF3E0',
  trash:   '#F1F3F4',
  starred: '#FEF7E0',
  archive: '#E0F7FA',
  snoozed: '#FCE4EC',
};

export default function FoldersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { folders, loading, refetch } = useFolders(user?.id);
  const { addresses } = useEmailAddresses(user?.id);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const { counts: unreadCounts } = useUnreadCounts(user?.id, selectedAddressId);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const primary = addresses.find(a => a.is_primary) ?? addresses[0];
      if (primary) setSelectedAddressId(primary.id);
    }
  }, [addresses]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Same sections as EmailSidebar
  const primaryTypes = ['inbox', 'starred', 'snoozed'];
  const sendTypes = ['sent', 'drafts'];
  const manageTypes = ['archive', 'spam', 'trash'];
  const primary = folders.filter(f => primaryTypes.includes(f.type));
  const send = folders.filter(f => sendTypes.includes(f.type));
  const manage = folders.filter(f => manageTypes.includes(f.type));
  const other = folders.filter(
    f => !primaryTypes.includes(f.type) && !sendTypes.includes(f.type) && !manageTypes.includes(f.type)
  );

  const renderFolder = (folder: Folder) => {
    const unread = unreadCounts[folder.id] || 0;
    const icon = getFolderIcon(folder);
    const iconColor = FOLDER_COLOR[folder.type] || colors.textDim;
    const iconBg = FOLDER_BG[folder.type] || colors.bgSection;
    return (
      <TouchableOpacity key={folder.id} style={styles.folderRow} activeOpacity={0.7}>
        <View style={[styles.folderIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
        <Text style={styles.folderLabel}>{folderLabel(folder)}</Text>
        <View style={styles.folderMeta}>
          {unread > 0 && (
            <View style={[styles.countBadge, { backgroundColor: iconColor }]}>
              <Text style={styles.countBadgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={colors.textHint} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (title: string, items: Folder[]) => {
    if (items.length === 0) return null;
    return (
      <View key={title} style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCard}>
          {items.map((folder, i) => (
            <View key={folder.id}>
              {renderFolder(folder)}
              {i < items.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgCard} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mail</Text>
          <Text style={styles.headerSub}>All folders and labels</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Compose', {})}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Email address switcher (same as EmailAddressSwitcher) */}
      {addresses.length > 1 && (
        <View style={styles.addressBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
            {addresses.map(addr => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addressChip, selectedAddressId === addr.id && styles.addressChipActive]}
                onPress={() => setSelectedAddressId(addr.id)}
              >
                <Text style={[styles.addressChipText, selectedAddressId === addr.id && styles.addressChipTextActive]}>
                  {addr.full_email}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.addressChip, selectedAddressId === 'all' && styles.addressChipActive]}
              onPress={() => setSelectedAddressId('all')}
            >
              <Text style={[styles.addressChipText, selectedAddressId === 'all' && styles.addressChipTextActive]}>
                All inboxes
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Same sections as EmailSidebar: Mail / Send / Manage */}
          {renderSection('Mail', primary)}
          {renderSection('Send', send)}
          {renderSection('Manage', manage)}
          {other.length > 0 && renderSection('Folders', other)}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 14,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  headerBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 22,
  },

  addressBar: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addressChip: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.bgSection,
  },
  addressChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  addressChipText: { fontSize: 12, color: colors.textDim },
  addressChipTextActive: { color: colors.primary, fontWeight: '600' },

  content: { padding: 16 },

  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.textFaint,
    marginBottom: 6,
    paddingHorizontal: 4,
    marginTop: 16,
  },
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  rowDivider: { height: 1, backgroundColor: colors.borderLight, marginHorizontal: 16 },
  folderIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  folderLabel: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '400' },
  folderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countBadge: {
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Switch, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useEmailAddresses } from '../hooks/useEmails';
import { colors } from '../lib/colors';
import { Profile } from '../types';

interface RowItem {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  sub?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
}

function SettingRow({ item, isLast }: { item: RowItem; isLast: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={item.toggle ? undefined : item.onPress}
      activeOpacity={item.toggle ? 1 : 0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={18} color={item.iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, item.danger && styles.rowLabelDanger]}>{item.label}</Text>
        {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
      </View>
      {item.toggle ? (
        <Switch
          value={item.toggleValue}
          onValueChange={item.onToggle}
          trackColor={{ false: colors.bgSection, true: colors.primary + 'AA' }}
          thumbColor={item.toggleValue ? colors.primary : '#fff'}
          ios_backgroundColor={colors.bgSection}
        />
      ) : item.value ? (
        <Text style={styles.rowValue}>{item.value}</Text>
      ) : !item.danger ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textHint} />
      ) : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation();
  const { addresses, loading: loadingAddresses } = useEmailAddresses(user?.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { setProfile(data); setLoadingProfile(false); });
    (supabase as any)
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => { if (data) setActivePlan(data.plan_id); });
  }, [user]);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Sign out of AfuChat Mail?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const primaryEmail = addresses.find(a => a.is_primary)?.full_email ?? user?.email ?? '';
  const displayName = profile?.full_name ?? primaryEmail.split('@')[0] ?? 'You';
  const initials = displayName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();

  const planLabel = activePlan
    ? activePlan.charAt(0).toUpperCase() + activePlan.slice(1)
    : 'Free';

  const sections: { title: string; items: RowItem[] }[] = [
    {
      title: 'Account',
      items: [
        {
          icon: 'person-circle-outline',
          iconColor: colors.primary,
          iconBg: colors.primaryLight,
          label: 'Profile',
          sub: primaryEmail,
        },
        {
          icon: 'at-outline',
          iconColor: '#34A853',
          iconBg: '#E6F4EA',
          label: 'Email addresses',
          value: `${addresses.length || 1}`,
        },
        {
          icon: 'globe-outline',
          iconColor: '#00BCD4',
          iconBg: '#E0F7FA',
          label: 'Custom domains',
          sub: 'Bring your own domain',
        },
        {
          icon: 'card-outline',
          iconColor: '#FBBC04',
          iconBg: '#FEF7E0',
          label: 'Subscription',
          value: planLabel,
        },
      ],
    },
    {
      title: 'Mail settings',
      items: [
        {
          icon: 'notifications-outline',
          iconColor: '#FF6D00',
          iconBg: '#FFF3E0',
          label: 'Notifications',
          sub: 'Push, badges, sounds',
          toggle: true,
          toggleValue: notifications,
          onToggle: setNotifications,
        },
        {
          icon: 'sync-outline',
          iconColor: colors.primary,
          iconBg: colors.primaryLight,
          label: 'Auto-sync',
          sub: 'Fetch new mail automatically',
          toggle: true,
          toggleValue: autoSync,
          onToggle: setAutoSync,
        },
        {
          icon: 'moon-outline',
          iconColor: '#5F6368',
          iconBg: '#F1F3F4',
          label: 'Dark theme',
          toggle: true,
          toggleValue: darkMode,
          onToggle: setDarkMode,
        },
        {
          icon: 'swap-horizontal-outline',
          iconColor: '#34A853',
          iconBg: '#E6F4EA',
          label: 'Swipe actions',
          sub: 'Customize swipe gestures',
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        {
          icon: 'lock-closed-outline',
          iconColor: '#EA4335',
          iconBg: '#FCE8E6',
          label: 'Password & 2FA',
        },
        {
          icon: 'shield-checkmark-outline',
          iconColor: '#9C27B0',
          iconBg: '#F3E5F5',
          label: 'Encryption',
          sub: 'End-to-end for all mail',
        },
        {
          icon: 'eye-off-outline',
          iconColor: '#5F6368',
          iconBg: '#F1F3F4',
          label: 'Tracking protection',
          sub: 'Remote images blocked',
        },
      ],
    },
    {
      title: 'More',
      items: [
        {
          icon: 'chatbubble-ellipses-outline',
          iconColor: '#2AABEE',
          iconBg: '#E3F2FD',
          label: 'Telegram notifications',
          sub: 'Connect Telegram bot',
        },
        {
          icon: 'information-circle-outline',
          iconColor: '#5F6368',
          iconBg: '#F1F3F4',
          label: 'About AfuChat Mail',
          value: 'v1.0.0',
        },
        {
          icon: 'help-circle-outline',
          iconColor: '#34A853',
          iconBg: '#E6F4EA',
          label: 'Help & Support',
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgCard} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Profile card (same as Settings page profile section) */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.8}>
          <View style={styles.profileAvatar}>
            {loadingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.profileAvatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{primaryEmail}</Text>
            <View style={styles.planBadge}>
              <Ionicons name="flash" size={11} color={colors.primary} />
              <Text style={styles.planBadgeText}>{planLabel} Plan</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textHint} />
        </TouchableOpacity>

        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <SettingRow key={item.label} item={item} isLast={i === section.items.length - 1} />
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>AfuChat Mail v1.0.0</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 14,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },

  content: { padding: 16 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  profileAvatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 2 },
  profileEmail: { fontSize: 13, color: colors.textDim, marginBottom: 6 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  planBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },

  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.8, color: colors.textFaint,
    marginBottom: 6, paddingHorizontal: 4, marginTop: 16,
  },
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowIcon: {
    width: 36, height: 36, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, color: colors.text },
  rowLabelDanger: { color: colors.danger },
  rowSub: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  rowValue: { fontSize: 14, color: colors.textFaint },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.bgCard, borderRadius: 16,
    paddingVertical: 16, marginTop: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  signOutText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
  versionText: { textAlign: 'center', color: colors.textHint, fontSize: 12, marginBottom: 8 },
});

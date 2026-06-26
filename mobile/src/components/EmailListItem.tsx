import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { Email } from '../types';
import { colors } from '../lib/colors';

interface Props {
  email: Email;
  onPress: () => void;
  onStar: () => void;
  onLongPress?: () => void;
}

// Same formatTime as EmailList.tsx
function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffHours = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (diffHours < 24) return format(d, 'HH:mm');
  return format(d, 'MMM dd');
}

// Same getInitials as EmailList.tsx
function getInitials(from: string): string {
  return (from.trim()[0] ?? '?').toUpperCase();
}

// Same avatar color palette as EmailViewer.tsx
const avatarPalette = [
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#EDE9FE', text: '#6D28D9' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#E0E7FF', text: '#3730A3' },
  { bg: '#CCFBF1', text: '#134E4A' },
];
function getAvatarColors(from: string) {
  let hash = 0;
  for (let i = 0; i < from.length; i++) hash = (hash * 31 + from.charCodeAt(i)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

// Same getParticipantCount as EmailList.tsx
function getParticipantCount(email: Email): number {
  const s = new Set([email.from_address, ...(email.to_addresses ?? []), ...(email.cc_addresses ?? [])]);
  return s.size;
}

export default function EmailListItem({ email, onPress, onStar, onLongPress }: Props) {
  const initial = getInitials(email.from_address);
  const palette = getAvatarColors(email.from_address);
  const dateStr = formatTime(email.received_at || email.created_at);
  const isUnread = !email.is_read;
  const participantCount = getParticipantCount(email);

  // Parse display name (same as EmailViewer parseFromAddress)
  const fromRaw = email.from_address || '';
  const match = fromRaw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const fromName = match ? match[1].trim() || match[2].trim() : fromRaw.split('@')[0] || fromRaw;

  const hasAttachments = Array.isArray(email.attachments)
    ? email.attachments.length > 0
    : typeof email.attachments === 'string' && email.attachments !== '[]' && email.attachments !== '';

  return (
    <TouchableOpacity
      style={[styles.container, isUnread && styles.containerUnread]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      delayLongPress={350}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
        <Text style={[styles.avatarText, { color: palette.text }]}>{initial}</Text>
      </View>

      {/* Content */}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.from, isUnread && styles.fromUnread]} numberOfLines={1}>
            {fromName}
            {participantCount > 1 ? ` (${participantCount})` : ''}
          </Text>
          <Text style={[styles.date, isUnread && styles.dateUnread]}>{dateStr}</Text>
        </View>

        <Text style={[styles.subject, isUnread && styles.subjectUnread]} numberOfLines={1}>
          {email.subject || '(no subject)'}
        </Text>

        <View style={styles.previewRow}>
          <Text style={styles.preview} numberOfLines={1}>
            {(email.body_text ?? '').replace(/\s+/g, ' ').trim() || 'No preview available'}
          </Text>
          {hasAttachments && (
            <Ionicons name="attach" size={14} color={colors.textFaint} style={{ marginLeft: 4 }} />
          )}
        </View>
      </View>

      {/* Star */}
      <TouchableOpacity
        style={styles.starBtn}
        onPress={onStar}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      >
        <Ionicons
          name={email.is_starred ? 'star' : 'star-outline'}
          size={18}
          color={email.is_starred ? colors.starred : colors.textHint}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
    minHeight: 72,
  },
  containerUnread: {
    backgroundColor: '#EEF4FD',
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  body: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  from: { fontSize: 14, color: colors.textDim, fontWeight: '400', flex: 1, marginRight: 8 },
  fromUnread: { color: colors.text, fontWeight: '700' },
  date: { fontSize: 12, color: colors.textFaint, flexShrink: 0 },
  dateUnread: { color: colors.text, fontWeight: '600' },
  subject: { fontSize: 14, color: colors.textDim, marginBottom: 2 },
  subjectUnread: { color: colors.text, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { fontSize: 13, color: colors.textFaint, flex: 1 },
  starBtn: { paddingLeft: 6, flexShrink: 0 },
});

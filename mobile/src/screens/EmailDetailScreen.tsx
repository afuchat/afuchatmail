import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar, Share, Alert, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useEmail, useThreadEmails } from '../hooks/useEmails';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../lib/colors';
import { RootStackParamList, Email, Attachment } from '../types';

type Route = RouteProp<RootStackParamList, 'EmailDetail'>;

// ─── Helpers (same as EmailViewer.tsx) ───────────────────────────────────

const parseFromAddress = (raw: string): { name: string; email: string } => {
  if (!raw) return { name: '', email: '' };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  const email = raw.trim();
  const local = email.split('@')[0] || email;
  return { name: local, email };
};

const avatarColors = [
  '#1A73E8', '#EA4335', '#34A853', '#FBBC04',
  '#9C27B0', '#FF6D00', '#00BCD4', '#E91E63',
];
function getAvatarColor(from: string): string {
  let sum = 0;
  for (let i = 0; i < from.length; i++) sum += from.charCodeAt(i);
  return avatarColors[sum % avatarColors.length];
}

function normalizeAttachments(raw: unknown): Attachment[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(a => a?.name) as Attachment[];
  if (typeof raw === 'string') {
    try { return normalizeAttachments(JSON.parse(raw)); } catch { return []; }
  }
  return [];
}

const FILE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: 'document-text',
  doc: 'document',
  docx: 'document',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  mp4: 'videocam',
  mp3: 'musical-note',
  zip: 'archive',
  xlsx: 'grid', xls: 'grid',
};
function getFileIcon(name: string): keyof typeof Ionicons.glyphMap {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? 'document-outline';
}

// ─── Single email bubble (same as EmailViewer's thread message rendering) ─

interface EmailBubbleProps {
  email: Email;
  expanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  onStar: () => void;
  onReply: () => void;
}

function EmailBubble({ email, expanded, isLast, onToggle, onStar, onReply }: EmailBubbleProps) {
  const { name, email: fromEmail } = parseFromAddress(email.from_address);
  const avatarColor = getAvatarColor(email.from_address);
  const initials = (name?.[0] || fromEmail?.[0] || '?').toUpperCase();
  const attachments = normalizeAttachments(email.attachments);

  const dateStr = email.received_at
    ? format(new Date(email.received_at), 'EEE, MMM d · h:mm a')
    : email.created_at
      ? format(new Date(email.created_at), 'EEE, MMM d · h:mm a')
      : '';

  const relativeDate = email.received_at || email.created_at
    ? formatDistanceToNow(new Date(email.received_at || email.created_at), { addSuffix: true })
    : '';

  return (
    <View style={styles.bubble}>
      {/* Sender row — always visible */}
      <TouchableOpacity style={styles.bubbleSenderRow} onPress={onToggle} activeOpacity={0.7}>
        <View style={[styles.bubbleAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.bubbleAvatarText}>{initials}</Text>
        </View>
        <View style={styles.bubbleSenderInfo}>
          <Text style={styles.bubbleSenderName}>{name || fromEmail}</Text>
          {!expanded && (
            <Text style={styles.bubblePreview} numberOfLines={1}>
              {(email.body_text ?? '').replace(/\s+/g, ' ').trim()}
            </Text>
          )}
          {expanded && <Text style={styles.bubbleSenderEmail}>{dateStr}</Text>}
        </View>
        <View style={styles.bubbleMetaRight}>
          {!expanded && <Text style={styles.bubbleRelDate}>{relativeDate}</Text>}
          <TouchableOpacity onPress={onStar} style={styles.bubbleStarBtn}>
            <Ionicons
              name={email.is_starred ? 'star' : 'star-outline'}
              size={18}
              color={email.is_starred ? colors.starred : colors.textHint}
            />
          </TouchableOpacity>
          {expanded && (
            <TouchableOpacity onPress={onReply} style={styles.bubbleReplyBtn}>
              <Ionicons name="arrow-undo-outline" size={18} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Body — only when expanded (same as EmailViewer's expandedEmails set) */}
      {expanded && (
        <>
          <View style={styles.bubbleBody}>
            <Text style={styles.bubbleBodyText}>{email.body_text || '(No content)'}</Text>
          </View>

          {/* Attachments */}
          {attachments.length > 0 && (
            <View style={styles.bubbleAttachments}>
              <View style={styles.attachDivider} />
              <Text style={styles.attachTitle}>
                {attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}
              </Text>
              {attachments.map((att, i) => (
                <View key={i} style={styles.attachRow}>
                  <View style={styles.attachIconWrap}>
                    <Ionicons name={getFileIcon(att.name)} size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachName} numberOfLines={1}>{att.name}</Text>
                    {att.size > 0 && (
                      <Text style={styles.attachSize}>{(att.size / 1024).toFixed(0)} KB</Text>
                    )}
                  </View>
                  <Ionicons name="download-outline" size={16} color={colors.textFaint} />
                </View>
              ))}
            </View>
          )}

          {/* Reply / Forward buttons at bottom of last email */}
          {isLast && (
            <View style={styles.bubbleActions}>
              <TouchableOpacity style={styles.bubbleActionBtn} onPress={onReply}>
                <Ionicons name="arrow-undo-outline" size={16} color={colors.primary} />
                <Text style={styles.bubbleActionText}>Reply</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── EmailDetailScreen ────────────────────────────────────────────────────

export default function EmailDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { emailId } = route.params;
  const { user } = useAuth();

  const { email, loading } = useEmail(emailId);
  const { threadEmails, loadingThread } = useThreadEmails(email);

  // Auto-expand latest email in thread (same as EmailViewer)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([emailId]));
  const [isTrash, setIsTrash] = useState(false);

  useEffect(() => {
    if (threadEmails.length > 0) {
      const latest = threadEmails[threadEmails.length - 1];
      setExpandedIds(new Set([latest.id]));
    }
  }, [threadEmails]);

  // Mark as read on open (same as Dashboard handleEmailSelect)
  useEffect(() => {
    if (email && !email.is_read) {
      supabase.from('emails').update({ is_read: true }).eq('id', emailId);
    }
  }, [email, emailId]);

  // Check if in trash (same as EmailViewer)
  useEffect(() => {
    if (!email?.folder_id || !user) return;
    supabase.from('folders').select('type').eq('id', email.folder_id).single()
      .then(({ data }) => setIsTrash(data?.type === 'trash'));
  }, [email?.folder_id, user]);

  const toggleStar = async (e: Email) => {
    const next = !e.is_starred;
    await supabase.from('emails').update({ is_starred: next }).eq('id', e.id);
  };

  const handleDelete = async () => {
    if (!user || !email) return;
    if (isTrash) {
      Alert.alert('Delete permanently?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            await supabase.from('emails').delete().eq('id', email.id);
            navigation.goBack();
          },
        },
      ]);
    } else {
      const { data: trashFolder } = await supabase
        .from('folders').select('id').eq('user_id', user.id).eq('type', 'trash').single();
      if (!trashFolder) return;
      await supabase.from('emails').update({
        folder_id: trashFolder.id,
        original_folder_id: email.folder_id,
        deleted_at: new Date().toISOString(),
      }).eq('id', email.id);
      navigation.goBack();
    }
  };

  const handleRestore = async () => {
    if (!user || !email) return;
    const targetFolderId = email.original_folder_id ?? (
      await supabase.from('folders').select('id').eq('user_id', user.id).eq('type', 'inbox').single()
        .then(({ data }) => data?.id)
    );
    if (!targetFolderId) return;
    await supabase.from('emails').update({
      folder_id: targetFolderId,
      deleted_at: null,
      original_folder_id: null,
    }).eq('id', email.id);
    navigation.goBack();
  };

  const handleReply = (e: Email) => {
    navigation.navigate('Compose', {
      replyTo: {
        ...e,
        subject: e.subject?.startsWith('Re:') ? e.subject : `Re: ${e.subject ?? ''}`,
      } as any,
    });
  };

  const handleShare = async () => {
    if (!email) return;
    await Share.share({ message: `${email.subject}\n\n${email.body_text ?? ''}` });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!email) {
    return (
      <View style={styles.center}>
        <Ionicons name="mail-unread-outline" size={56} color={colors.textHint} />
        <Text style={styles.errorText}>Email not found</Text>
      </View>
    );
  }

  const displayEmails = threadEmails.length > 0 ? threadEmails : [email];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgCard} />

      {/* Top action bar (same as EmailViewer top row) */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textDim} />
        </TouchableOpacity>
        <View style={styles.topBarActions}>
          {isTrash ? (
            <TouchableOpacity style={styles.topBarBtn} onPress={handleRestore}>
              <Ionicons name="arrow-undo-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.topBarBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBarBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBarBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Subject */}
        <View style={styles.subjectRow}>
          <Text style={styles.subject}>{email.subject || '(no subject)'}</Text>
          {email.is_important && (
            <View style={styles.importantBadge}>
              <Ionicons name="bookmark" size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Trash notice (same as EmailViewer) */}
        {isTrash && (
          <View style={styles.trashNotice}>
            <Ionicons name="trash-outline" size={14} color="#92400E" />
            <Text style={styles.trashNoticeText}>
              This email is in the trash.{' '}
              <Text style={styles.trashRestoreLink} onPress={handleRestore}>Restore it</Text>
            </Text>
          </View>
        )}

        {/* Thread emails (same as EmailViewer thread bubble rendering) */}
        {loadingThread && displayEmails.length <= 1 ? (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : (
          <View style={styles.threadContainer}>
            {displayEmails.map((e, idx) => (
              <EmailBubble
                key={e.id}
                email={e}
                expanded={expandedIds.has(e.id)}
                isLast={idx === displayEmails.length - 1}
                onToggle={() => {
                  setExpandedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                    return next;
                  });
                }}
                onStar={() => {
                  const next = !e.is_starred;
                  supabase.from('emails').update({ is_starred: next }).eq('id', e.id);
                }}
                onReply={() => handleReply(e)}
              />
            ))}
          </View>
        )}

        {/* Reply / Forward bottom buttons */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.bottomActionBtn} onPress={() => handleReply(email)}>
            <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
            <Text style={styles.bottomActionText}>Reply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bottomActionBtn, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('Compose', {
              replyTo: { ...email, subject: `Fwd: ${email.subject}`, from_address: '' } as any,
            })}>
            <Ionicons name="arrow-redo-outline" size={18} color={colors.textDim} />
            <Text style={[styles.bottomActionText, { color: colors.textDim }]}>Forward</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 12 },
  errorText: { color: colors.textFaint, fontSize: 16 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: Platform.OS === 'ios' ? 50 : 8,
    paddingBottom: 4,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  topBarActions: { flexDirection: 'row' },

  scroll: { flex: 1 },

  subjectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  subject: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 28, letterSpacing: -0.3 },
  importantBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.yellow,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 4,
  },

  trashNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  trashNoticeText: { fontSize: 13, color: '#92400E', flex: 1 },
  trashRestoreLink: { fontWeight: '700', textDecorationLine: 'underline' },

  threadContainer: { paddingHorizontal: 12, gap: 4, paddingBottom: 8 },

  bubble: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleSenderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  bubbleAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubbleAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  bubbleSenderInfo: { flex: 1 },
  bubbleSenderName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  bubbleSenderEmail: { fontSize: 12, color: colors.textFaint },
  bubblePreview: { fontSize: 13, color: colors.textFaint },
  bubbleMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  bubbleRelDate: { fontSize: 11, color: colors.textFaint },
  bubbleStarBtn: { padding: 4 },
  bubbleReplyBtn: { padding: 4 },

  bubbleBody: { paddingHorizontal: 14, paddingBottom: 14 },
  bubbleBodyText: { fontSize: 14, color: colors.textMuted, lineHeight: 24, letterSpacing: 0.1 },

  bubbleAttachments: { paddingHorizontal: 14, paddingBottom: 14 },
  attachDivider: { height: 1, backgroundColor: colors.border, marginBottom: 10 },
  attachTitle: { fontSize: 12, fontWeight: '600', color: colors.textDim, marginBottom: 8 },
  attachRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgSection,
    borderRadius: 8, padding: 10, marginBottom: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  attachIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  attachName: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 1 },
  attachSize: { fontSize: 11, color: colors.textFaint },

  bubbleActions: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  bubbleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  bubbleActionText: { color: colors.primary, fontWeight: '600', fontSize: 14 },

  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bottomActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.bgCard,
  },
  bottomActionText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});

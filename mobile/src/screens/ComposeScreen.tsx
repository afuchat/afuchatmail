import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useEmailAddresses } from '../hooks/useEmails';
import { colors } from '../lib/colors';
import { RootStackParamList, Email } from '../types';

type Route = RouteProp<RootStackParamList, 'Compose'>;

// Same as EmailComposer.tsx: build a quoted reply body
function buildReplyBody(original: Email, fromQuote = false): string {
  const date = original.received_at || original.created_at || '';
  const dateStr = date ? new Date(date).toLocaleString() : '';
  const header = `\n\n\n— On ${dateStr}, ${original.from_address} wrote:`;
  const body = (original.body_text ?? '').split('\n').map(l => `> ${l}`).join('\n');
  return header + '\n' + body;
}

export default function ComposeScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const replyTo = route.params?.replyTo;

  const { addresses } = useEmailAddresses(user?.id);

  const [fromAddressId, setFromAddressId] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<TextInput>(null);

  // Pre-fill for reply/forward (same as EmailComposer)
  useEffect(() => {
    if (!replyTo) return;
    const replyToAddr = replyTo.reply_to || replyTo.from_address;
    setTo(replyToAddr);
    const subj = replyTo.subject ?? '';
    setSubject(subj.startsWith('Re:') ? subj : `Re: ${subj}`);
    setBody(buildReplyBody(replyTo));
  }, [replyTo?.id]);

  // Set primary email as from address (same as EmailComposer)
  useEffect(() => {
    if (addresses.length > 0 && !fromAddressId) {
      const primary = addresses.find(a => a.is_primary) ?? addresses[0];
      if (primary) setFromAddressId(primary.id);
    }
  }, [addresses]);

  const fromAddress = addresses.find(a => a.id === fromAddressId);

  const handleSend = async () => {
    if (!to.trim()) {
      Alert.alert('Missing recipient', 'Please enter at least one recipient.');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('No subject', 'Send without a subject?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send anyway', onPress: doSend },
      ]);
      return;
    }
    doSend();
  };

  const doSend = async () => {
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        subject: subject.trim(),
        body_text: body.trim(),
        from_address_id: fromAddressId,
      };
      if (cc) payload.cc = cc.split(',').map(s => s.trim()).filter(Boolean);
      if (bcc) payload.bcc = bcc.split(',').map(s => s.trim()).filter(Boolean);
      // Include thread info for replies (same as EmailComposer)
      if (replyTo?.thread_id) payload.reply_to_thread_id = replyTo.thread_id;
      if (replyTo?.id) payload.in_reply_to_id = replyTo.id;

      const { error } = await supabase.functions.invoke('send-email', { body: payload });
      if (error) throw error;
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Send failed', e?.message ?? 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = () => {
    if (to || subject || body.trim()) {
      Alert.alert('Discard draft?', 'Your message will be discarded.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgCard} />

      {/* Header (same layout as EmailComposer header) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDiscard} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={colors.textDim} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {replyTo ? 'Reply' : 'New message'}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.sendBtn, (!to.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={sending || !to.trim()}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* From (same as EmailComposer: shows from address with dropdown) */}
        {addresses.length > 0 && (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>From</Text>
              {addresses.length === 1 ? (
                <Text style={styles.fieldStatic}>{fromAddress?.full_email ?? ''}</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {addresses.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.fromChip, fromAddressId === a.id && styles.fromChipActive]}
                      onPress={() => setFromAddressId(a.id)}
                    >
                      <Text style={[styles.fromChipText, fromAddressId === a.id && styles.fromChipTextActive]}>
                        {a.full_email}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
            <View style={styles.divider} />
          </>
        )}

        {/* To */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>To</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Recipients"
            placeholderTextColor={colors.textHint}
            value={to}
            onChangeText={setTo}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
          <TouchableOpacity onPress={() => setShowCcBcc(v => !v)} style={styles.ccBtn}>
            <Text style={styles.ccBtnText}>{showCcBcc ? 'Hide' : 'Cc/Bcc'}</Text>
          </TouchableOpacity>
        </View>

        {/* Cc / Bcc (same as EmailComposer — shown when showCcBcc) */}
        {showCcBcc && (
          <>
            <View style={styles.divider} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Cc</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Cc"
                placeholderTextColor={colors.textHint}
                value={cc}
                onChangeText={setCc}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Bcc</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Bcc"
                placeholderTextColor={colors.textHint}
                value={bcc}
                onChangeText={setBcc}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        <View style={styles.divider} />

        {/* Subject */}
        <View style={styles.field}>
          <TextInput
            style={[styles.fieldInput, styles.subjectInput]}
            placeholder="Subject"
            placeholderTextColor={colors.textHint}
            value={subject}
            onChangeText={setSubject}
            returnKeyType="next"
            onSubmitEditing={() => bodyRef.current?.focus()}
          />
        </View>

        <View style={styles.divider} />

        {/* Body */}
        <TextInput
          ref={bodyRef}
          style={styles.bodyInput}
          placeholder="Compose email"
          placeholderTextColor={colors.textHint}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          autoCorrect
          autoCapitalize="sentences"
        />

        {/* Signature */}
        <View style={styles.signature}>
          <Text style={styles.signatureText}>
            {'— '}
            <Text style={{ color: colors.primary }}>AfuChat Mail</Text>
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Toolbar (same as EmailComposer bottom toolbar) */}
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>
          {([
            ['attach-outline', 'Attach file'],
            ['image-outline', 'Image'],
            ['link-outline', 'Link'],
          ] as [keyof typeof Ionicons.glyphMap, string][]).map(([icon, label]) => (
            <TouchableOpacity key={label} style={styles.toolbarBtn}>
              <Ionicons name={icon} size={22} color={colors.textDim} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgCard },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
    gap: 4,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text, marginLeft: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  sendBtnDisabled: { opacity: 0.4 },

  form: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 8,
    minHeight: 50,
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  fieldLabel: { width: 40, fontSize: 14, color: colors.textFaint },
  fieldStatic: { flex: 1, fontSize: 15, color: colors.text },
  fieldInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  subjectInput: { fontWeight: '500' },
  ccBtn: { paddingHorizontal: 4 },
  ccBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  fromChip: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
  },
  fromChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  fromChipText: { fontSize: 12, color: colors.textDim },
  fromChipTextActive: { color: colors.primary, fontWeight: '600' },

  bodyInput: {
    fontSize: 15, color: colors.text,
    lineHeight: 24,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    minHeight: 220,
  },
  signature: { paddingHorizontal: 16, paddingBottom: 12 },
  signatureText: { fontSize: 13, color: colors.textHint },

  toolbar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 4,
  },
  toolbarContent: { paddingHorizontal: 8, gap: 4 },
  toolbarBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
});

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Email, EmailThread, Folder } from '../types';

// ─── Offline cache helpers (AsyncStorage) ──────────────────────────────────

const CACHE_KEY = 'afuchat_emails_cache';

async function saveCache(emails: Email[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(emails));
  } catch {}
}

async function loadCache(opts?: {
  folderId?: string | null;
  emailAddressId?: string | null;
  searchQuery?: string;
}): Promise<Email[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    let emails: Email[] = JSON.parse(raw);
    if (opts?.folderId) emails = emails.filter(e => e.folder_id === opts.folderId);
    if (opts?.emailAddressId && opts.emailAddressId !== 'all')
      emails = emails.filter(e => e.email_address_id === opts.emailAddressId);
    if (opts?.searchQuery) {
      const q = opts.searchQuery.toLowerCase();
      emails = emails.filter(e =>
        e.subject?.toLowerCase().includes(q) ||
        e.from_address?.toLowerCase().includes(q) ||
        e.body_text?.toLowerCase().includes(q) ||
        e.to_addresses?.some(a => a.toLowerCase().includes(q))
      );
    }
    return emails;
  } catch {
    return [];
  }
}

async function updateCacheEmail(id: string, updates: Partial<Email>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const emails: Email[] = JSON.parse(raw);
    const updated = emails.map(e => e.id === id ? { ...e, ...updates } : e);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  } catch {}
}

async function removeCacheEmail(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const emails: Email[] = JSON.parse(raw);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(emails.filter(e => e.id !== id)));
  } catch {}
}

// ─── Thread grouping (same algorithm as website's EmailList.tsx) ─────────

export function groupEmailsIntoThreads(emailList: Email[]): EmailThread[] {
  const threadMap = new Map<string, Email[]>();
  const activeThreadIds = new Set<string>();

  emailList.forEach(email => {
    if (email.thread_id) activeThreadIds.add(email.thread_id);
  });

  emailList.forEach(email => {
    if (email.thread_id) {
      const existing = threadMap.get(email.thread_id) || [];
      threadMap.set(email.thread_id, [...existing, email]);
    } else if (activeThreadIds.has(email.id)) {
      const existing = threadMap.get(email.id) || [];
      threadMap.set(email.id, [...existing, email]);
    } else {
      threadMap.set(email.id, [email]);
    }
  });

  const threadList: EmailThread[] = [];

  threadMap.forEach((threadEmails) => {
    const sortedEmails = [...threadEmails].sort((a, b) =>
      new Date(b.created_at || b.received_at || '').getTime() -
      new Date(a.created_at || a.received_at || '').getTime()
    );
    threadList.push({
      thread_id: sortedEmails[0].thread_id || sortedEmails[0].id,
      emails: sortedEmails,
      latest_email: sortedEmails[0],
      unread_count: sortedEmails.filter(e => !e.is_read).length,
    });
  });

  threadList.sort((a, b) => {
    const dA = new Date(a.latest_email.created_at || a.latest_email.received_at || '').getTime();
    const dB = new Date(b.latest_email.created_at || b.latest_email.received_at || '').getTime();
    return dB - dA;
  });

  return threadList;
}

// ─── Folder label map (same as EmailSidebar) ──────────────────────────────

export function folderLabel(folder: Folder): string {
  const map: Record<string, string> = {
    inbox: 'Inbox',
    sent: 'Sent',
    drafts: 'Drafts',
    spam: 'Spam',
    trash: 'Trash',
    starred: 'Starred',
    archive: 'Archive',
    snoozed: 'Snoozed',
  };
  return map[folder.type] || folder.name;
}

// ─── useFolders ────────────────────────────────────────────────────────────

export function useFolders(userId: string | undefined) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolders = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      setFolders(data ?? []);
    } catch {}
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  return { folders, loading, refetch: fetchFolders };
}

// ─── useUnreadCounts (same logic as EmailSidebar's fetchUnreadCounts) ──────

export function useUnreadCounts(userId: string | undefined, emailAddressId: string | null) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    if (!userId) return;
    try {
      let query = supabase
        .from('emails')
        .select('folder_id')
        .eq('user_id', userId)
        .eq('is_read', false);
      if (emailAddressId && emailAddressId !== 'all') {
        query = query.eq('email_address_id', emailAddressId);
      }
      const { data } = await query;
      if (!data) return;
      const c: Record<string, number> = {};
      for (const email of data) {
        if (email.folder_id) c[email.folder_id] = (c[email.folder_id] || 0) + 1;
      }
      setCounts(c);
    } catch {}
  }, [userId, emailAddressId]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Real-time for unread counts (same as EmailSidebar)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('sidebar-unread-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, () => {
        fetchCounts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, emailAddressId, fetchCounts]);

  return { counts, refetch: fetchCounts };
}

// ─── useEmails (main hook — same logic as EmailList.tsx) ──────────────────

interface UseEmailsOptions {
  userId: string | undefined;
  folderId: string | undefined;
  emailAddressId: string | null;
  searchQuery?: string;
  refreshTrigger?: number;
}

export function useEmails({
  userId,
  folderId,
  emailAddressId,
  searchQuery = '',
  refreshTrigger = 0,
}: UseEmailsOptions) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [isTrashFolder, setIsTrashFolder] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Update threads whenever emails change (same as EmailList's useEffect on [emails])
  useEffect(() => {
    setThreads(groupEmailsIntoThreads(emails));
  }, [emails]);

  // Check if current folder is trash (same as EmailList)
  const checkTrashFolder = useCallback(async () => {
    if (!folderId || !userId) { setIsTrashFolder(false); return; }
    try {
      const { data } = await supabase
        .from('folders')
        .select('type')
        .eq('id', folderId)
        .single();
      if (mountedRef.current) setIsTrashFolder(data?.type === 'trash');
    } catch {}
  }, [folderId, userId]);

  const fetchEmails = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (!emailAddressId) {
      setEmails([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      let query = supabase
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (emailAddressId !== 'all') {
        query = query.eq('email_address_id', emailAddressId);
      }
      if (folderId) {
        query = query.eq('folder_id', folderId);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredEmails = data || [];

      // Cache all fetched emails for offline use (before search filter)
      if (data && data.length > 0) {
        saveCache(data);
      }

      // Apply search filter (same as EmailList)
      if (searchQuery && searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        filteredEmails = filteredEmails.filter(email =>
          email.subject?.toLowerCase().includes(searchLower) ||
          email.from_address?.toLowerCase().includes(searchLower) ||
          email.body_text?.toLowerCase().includes(searchLower) ||
          email.to_addresses?.some((a: string) => a.toLowerCase().includes(searchLower))
        );
      }

      if (mountedRef.current) {
        setEmails(filteredEmails);
        setOffline(false);
      }
    } catch {
      // Fallback to cache on network error (same as EmailList)
      const cached = await loadCache({ folderId, emailAddressId, searchQuery });
      if (cached.length > 0 && mountedRef.current) {
        setEmails(cached);
        setOffline(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId, folderId, emailAddressId, searchQuery]);

  useEffect(() => {
    setLoading(true);
    fetchEmails();
    checkTrashFolder();
  }, [fetchEmails, checkTrashFolder, refreshTrigger]);

  // Real-time subscription for new emails (same as EmailList)
  useEffect(() => {
    if (!emailAddressId || !userId) return;
    const channel = supabase
      .channel('emails-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, async (payload) => {
        const newEmail = payload.new as Email;
        if (newEmail.user_id !== userId) return;
        if (emailAddressId !== 'all' && newEmail.email_address_id !== emailAddressId) return;
        if (!folderId || newEmail.folder_id === folderId) {
          if (mountedRef.current) {
            setEmails(prev => [newEmail, ...prev]);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [folderId, emailAddressId, userId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchEmails(true);
  }, [fetchEmails]);

  // ── CRUD operations (matching EmailList.tsx exactly) ──────────────────

  const toggleStar = useCallback(async (emailId: string, currentStarred: boolean) => {
    // Optimistic update (same as EmailList)
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_starred: !currentStarred } : e));
    updateCacheEmail(emailId, { is_starred: !currentStarred });
    try {
      await supabase.from('emails').update({ is_starred: !currentStarred }).eq('id', emailId);
    } catch {
      // Revert on error
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_starred: currentStarred } : e));
    }
  }, []);

  const markRead = useCallback(async (emailId: string) => {
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_read: true } : e));
    updateCacheEmail(emailId, { is_read: true });
    await supabase.from('emails').update({ is_read: true }).eq('id', emailId);
  }, []);

  // Delete: move to trash or permanently delete if already in trash (same as EmailList)
  const deleteEmail = useCallback(async (emailId: string) => {
    if (!userId) return;
    try {
      const { data: trashFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'trash')
        .single();

      if (!trashFolder) return;

      const email = emails.find(e => e.id === emailId);
      const alreadyInTrash = isTrashFolder;

      if (alreadyInTrash) {
        await supabase.from('emails').delete().eq('id', emailId);
        removeCacheEmail(emailId);
      } else {
        await supabase.from('emails').update({
          folder_id: trashFolder.id,
          original_folder_id: email?.folder_id,
          deleted_at: new Date().toISOString(),
        }).eq('id', emailId);
        updateCacheEmail(emailId, { folder_id: trashFolder.id });
      }
      setEmails(prev => prev.filter(e => e.id !== emailId));
    } catch {}
  }, [userId, emails, isTrashFolder]);

  // Restore: put back to original_folder_id or inbox (same as EmailList)
  const restoreEmail = useCallback(async (emailId: string) => {
    if (!userId) return;
    try {
      const email = emails.find(e => e.id === emailId);
      let targetFolderId = email?.original_folder_id;

      if (!targetFolderId) {
        const { data: inboxFolder } = await supabase
          .from('folders').select('id').eq('user_id', userId).eq('type', 'inbox').single();
        targetFolderId = inboxFolder?.id;
      }

      if (!targetFolderId) return;

      await supabase.from('emails').update({
        folder_id: targetFolderId,
        deleted_at: null,
        original_folder_id: null,
      }).eq('id', emailId);

      setEmails(prev => prev.filter(e => e.id !== emailId));
    } catch {}
  }, [userId, emails]);

  // Bulk mark as read (same as EmailList)
  const bulkMarkAsRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await supabase.from('emails').update({ is_read: true }).in('id', ids);
      setEmails(prev => prev.map(e => ids.includes(e.id) ? { ...e, is_read: true } : e));
    } catch {}
  }, []);

  // Bulk delete (same as EmailList)
  const bulkDelete = useCallback(async (ids: string[]) => {
    if (ids.length === 0 || !userId) return;
    try {
      const { data: trashFolder } = await supabase
        .from('folders').select('id').eq('user_id', userId).eq('type', 'trash').single();
      if (!trashFolder) return;

      if (isTrashFolder) {
        for (const id of ids) {
          await supabase.from('emails').delete().eq('id', id);
        }
      } else {
        for (const id of ids) {
          const em = emails.find(e => e.id === id);
          await supabase.from('emails').update({
            folder_id: trashFolder.id,
            original_folder_id: em?.folder_id,
            deleted_at: new Date().toISOString(),
          }).eq('id', id);
        }
      }
      setEmails(prev => prev.filter(e => !ids.includes(e.id)));
    } catch {}
  }, [userId, emails, isTrashFolder]);

  // Mark all as read (same as EmailList)
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      let query = supabase.from('emails').update({ is_read: true })
        .eq('user_id', userId).eq('is_read', false);
      if (folderId) query = (query as any).eq('folder_id', folderId);
      await query;
      setEmails(prev => prev.map(e => ({ ...e, is_read: true })));
    } catch {}
  }, [userId, folderId]);

  return {
    emails,
    threads,
    loading,
    refreshing,
    offline,
    isTrashFolder,
    refresh,
    toggleStar,
    markRead,
    deleteEmail,
    restoreEmail,
    bulkMarkAsRead,
    bulkDelete,
    markAllAsRead,
  };
}

// ─── useEmail (single email for detail view) ──────────────────────────────

export function useEmail(emailId: string | undefined) {
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!emailId) return;
    supabase.from('emails').select('*').eq('id', emailId).single()
      .then(({ data }) => {
        setEmail(data);
        setLoading(false);
      });
  }, [emailId]);

  return { email, loading };
}

// ─── useThreadEmails (fetch full thread for EmailDetail — same as EmailViewer) ─

export function useThreadEmails(email: Email | null) {
  const [threadEmails, setThreadEmails] = useState<Email[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  useEffect(() => {
    if (!email) return;
    const threadId = email.thread_id || email.id;
    setLoadingThread(true);

    // Fetch thread: emails with thread_id = threadId OR id = threadId
    Promise.all([
      supabase.from('emails').select('*').eq('thread_id', threadId).order('created_at', { ascending: true }),
      supabase.from('emails').select('*').eq('id', threadId),
    ]).then(([byThread, byId]) => {
      const all: Email[] = [];
      const seen = new Set<string>();
      for (const e of [...(byThread.data ?? []), ...(byId.data ?? [])]) {
        if (!seen.has(e.id)) { seen.add(e.id); all.push(e); }
      }
      if (!all.find(e => e.id === email.id)) all.push(email);
      setThreadEmails(all.sort((a, b) =>
        new Date(a.created_at || a.received_at || '').getTime() -
        new Date(b.created_at || b.received_at || '').getTime()
      ));
      setLoadingThread(false);
    });
  }, [email?.id]);

  return { threadEmails, loadingThread };
}

// ─── useEmailAddresses ─────────────────────────────────────────────────────

export function useEmailAddresses(userId: string | undefined) {
  const [addresses, setAddresses] = useState<import('../types').EmailAddress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase.from('email_addresses').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAddresses(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  return { addresses, loading };
}

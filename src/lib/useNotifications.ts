import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { RecipientType, WaaNotification } from './types';

/**
 * Live notification tray for the signed-in principal.
 *
 * `waa_notifications` rows are written exclusively by database triggers
 * (new pending punch/request -> notify supervisor; approve/decline -> notify
 * worker). The client only ever SELECTs and flips `is_read` — never inserts.
 */
export function useNotifications(recipientId: string | undefined, recipientType: RecipientType) {
  const [items, setItems] = useState<WaaNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!recipientId) return;
    const { data } = await supabase
      .from('waa_notifications')
      .select('*')
      .eq('recipient_id', recipientId)
      .eq('recipient_type', recipientType)
      .order('created_at', { ascending: false })
      .limit(60);
    setItems((data as WaaNotification[]) ?? []);
    setLoading(false);
  }, [recipientId, recipientType]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: append/replace rows as the triggers fire.
  useEffect(() => {
    if (!recipientId) return;
    // supabase-js reuses an existing channel object when `.channel()` is
    // called with a topic name it already has registered. On a fast-refresh
    // or Strict Mode remount, the previous channel's `removeChannel()` (an
    // async unsubscribe) can still be in flight when this effect re-runs —
    // `.channel()` would then hand back that already-subscribed channel, and
    // calling `.on()` on it throws ("cannot add postgres_changes callbacks
    // ... after subscribe()"). A per-mount-unique topic suffix sidesteps the
    // collision entirely; the `filter` below still scopes the actual rows.
    const topic = `waa_notifications:${recipientType}:${recipientId}:${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waa_notifications',
          filter: `recipient_id=eq.${recipientId}`,
        },
        (payload) => {
          const row = payload.new as WaaNotification | undefined;
          if (!row || row.recipient_type !== recipientType) return;
          setItems((prev) => {
            const without = prev.filter((n) => n.id !== row.id);
            return [row, ...without].sort((a, b) => b.created_at.localeCompare(a.created_at));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [recipientId, recipientType]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic — the realtime echo will confirm it.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from('waa_notifications').update({ is_read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!recipientId) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from('waa_notifications')
      .update({ is_read: true })
      .eq('recipient_id', recipientId)
      .eq('recipient_type', recipientType)
      .eq('is_read', false);
  }, [recipientId, recipientType]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  return { items, loading, unreadCount, reload: load, markRead, markAllRead };
}

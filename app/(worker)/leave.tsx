import React, { useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useWorker } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { fetchWorkerLeaveRequests, submitLeaveRequest } from '../../src/lib/queries';
import { EmptyState } from '../../src/components/ui';
import { toneForStatus } from '../../src/theme';
import { dateRange, relativeStamp, toDateColumn } from '../../src/lib/format';
import { useWebTheme } from '../../src/web/webTheme';
import { Chip, GlassButton, GlassCard, GlassErrorBanner, GlassField, GlassScreen, WebPill, webToneFor } from '../../src/web/webUi';

const LEAVE_TYPES = ['Sick', 'Vacation', 'Emergency', 'Unpaid'];

export default function LeaveScreen() {
  const worker = useWorker();
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(new Date());
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(() => fetchWorkerLeaveRequests(worker.id), [worker.id]);

  async function submit() {
    if (to < from) {
      setError('The end date cannot be before the start date.');
      return;
    }
    if (!reason.trim()) {
      setError('Add a short reason for your leave.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await submitLeaveRequest({
        worker_id: worker.id,
        company_id: worker.company_id,
        leave_type: leaveType,
        date_from: toDateColumn(from),
        date_to: toDateColumn(to),
        reason: reason.trim(),
      });
      setReason('');
      await reload();
      Alert.alert('Leave filed', 'Your supervisor has been notified.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not file the leave request.');
    } finally {
      setBusy(false);
    }
  }

  function onDateChange(event: unknown, picked?: Date) {
    const target = picking;
    // Android's dialog dismisses itself; iOS keeps the spinner inline.
    if (Platform.OS === 'android') setPicking(null);
    if (!picked || !target) return;
    if (target === 'from') {
      setFrom(picked);
      if (to < picked) setTo(picked);
    } else {
      setTo(picked);
    }
  }

  return (
    <GlassScreen>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.muted} />}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>File leave</Text>
        {error ? <GlassErrorBanner message={error} /> : null}
        <GlassCard style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            Leave type
          </Text>
          <View style={s.typeRow}>
            {LEAVE_TYPES.map((t) => (
              <Chip key={t} label={t} active={leaveType === t} onPress={() => setLeaveType(t)} />
            ))}
          </View>

          <View style={s.dateRow}>
            <DateBox label="From" value={from} onPress={() => setPicking('from')} />
            <DateBox label="To" value={to} onPress={() => setPicking('to')} />
          </View>

          {picking ? (
            <DateTimePicker
              value={picking === 'from' ? from : to}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={onDateChange}
              minimumDate={picking === 'to' ? from : undefined}
            />
          ) : null}
          {picking && Platform.OS === 'ios' ? (
            <Pressable onPress={() => setPicking(null)} style={s.doneBtn}>
              <Text style={{ color: palette.accent2, fontWeight: '700', fontSize: 13 }}>Done</Text>
            </Pressable>
          ) : null}

          <GlassField label="Reason" value={reason} onChangeText={setReason} placeholder="Why are you filing leave?" multiline />

          <GlassButton label={busy ? 'Filing…' : 'File leave'} onPress={submit} loading={busy} />
        </GlassCard>

        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>Your leave history</Text>
        {(data?.length ?? 0) === 0 ? (
          <EmptyState title="No leave filed" body="Leave you file will be listed here." />
        ) : (
          data!.map((l) => (
            <GlassCard key={l.id} style={{ marginBottom: 9 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                    {l.leave_type} · {dateRange(l.date_from, l.date_to)}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17, marginTop: 2 }}>
                    {l.reason || 'No reason given'} · filed {relativeStamp(l.created_at)}
                  </Text>
                </View>
                <WebPill label={l.status} tone={webToneFor(toneForStatus(l.status))} />
              </View>
              {l.status === 'declined' && l.decline_remarks ? (
                <View style={{ backgroundColor: palette.badBg, borderRadius: 10, padding: 10, marginTop: 10 }}>
                  <Text style={{ fontSize: 12, color: palette.bad, lineHeight: 17 }}>Supervisor's remarks: {l.decline_remarks}</Text>
                </View>
              ) : null}
            </GlassCard>
          ))
        )}
      </ScrollView>
    </GlassScreen>
  );
}

function DateBox({ label, value, onPress }: { label: string; value: Date; onPress: () => void }) {
  const { palette } = useWebTheme();
  return (
    <Pressable style={[s.dateBox, { borderColor: palette.border, backgroundColor: palette.hover }]} onPress={onPress}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.muted, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
        {value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dateBox: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
});

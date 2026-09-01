import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useWorker } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { fetchWorkerLeaveRequests, submitLeaveRequest } from '../../src/lib/queries';
import { ScreenBody } from '../../src/components/Screen';
import {
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Loader,
  Pill,
  PrimaryButton,
  Section,
} from '../../src/components/ui';
import { colors, fonts, radius, spacing, toneForStatus, type } from '../../src/theme';
import { dateRange, relativeStamp, toDateColumn } from '../../src/lib/format';

const LEAVE_TYPES = ['Sick', 'Vacation', 'Emergency', 'Unpaid'];

export default function LeaveScreen() {
  const worker = useWorker();
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
    <ScreenBody refreshing={loading} onRefresh={reload}>
      <Section title="File leave">
        {error ? <ErrorNote message={error} /> : null}
        <Card style={{ padding: spacing.xl }}>
          <Text style={[type.label, { marginBottom: 6 }]}>Leave type</Text>
          <View style={s.typeRow}>
            {LEAVE_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setLeaveType(t)}
                style={[s.typeChip, leaveType === t && s.typeChipActive]}
              >
                <Text style={[s.typeText, leaveType === t && s.typeTextActive]}>{t}</Text>
              </Pressable>
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
              <Text style={s.doneText}>Done</Text>
            </Pressable>
          ) : null}

          <Field
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Why are you filing leave?"
            multiline
          />

          <PrimaryButton label={busy ? 'Filing…' : 'File leave'} onPress={submit} loading={busy} />
        </Card>
      </Section>

      <Section title="Your leave history">
        {loading && !data ? (
          <Loader />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title="No leave filed" body="Leave you file will be listed here." />
        ) : (
          data!.map((l) => (
            <Card key={l.id}>
              <View style={s.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={type.cardTitle}>
                    {l.leave_type} · {dateRange(l.date_from, l.date_to)}
                  </Text>
                  <Text style={type.cardSub}>
                    {l.reason || 'No reason given'} · filed {relativeStamp(l.created_at)}
                  </Text>
                </View>
                <Pill label={l.status} tone={toneForStatus(l.status)} />
              </View>
              {l.status === 'declined' && l.decline_remarks ? (
                <View style={s.remarks}>
                  <Text style={s.remarksText}>Supervisor's remarks: {l.decline_remarks}</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </Section>
    </ScreenBody>
  );
}

function DateBox({ label, value, onPress }: { label: string; value: Date; onPress: () => void }) {
  return (
    <Pressable style={s.dateBox} onPress={onPress}>
      <Text style={[type.label, { marginBottom: 4 }]}>{label}</Text>
      <Text style={s.dateValue}>
        {value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  typeChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  typeChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  typeText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.muted },
  typeTextActive: { color: colors.paper },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  dateBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 12,
    backgroundColor: colors.paper,
  },
  dateValue: { fontSize: 13.5, fontFamily: fonts.bodySemi, color: colors.ink },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  doneText: { color: colors.steel, fontFamily: fonts.bodyBold, fontSize: 13 },
  rowTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  remarks: { backgroundColor: colors.warnBg, borderRadius: 10, padding: 10, marginTop: 10 },
  remarksText: { fontSize: 12, color: colors.warn, lineHeight: 17, fontFamily: fonts.body },
});

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  decideLeaveRequest,
  decideTimeEntry,
  fetchPendingCashAdvances,
  fetchPendingLeaveRequests,
  fetchPendingTimeEntries,
} from '../../../src/lib/queries';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import { EmptyState, Loader, Section } from '../../../src/components/ui';
import {
  CashAdvanceNoticeCard,
  PunchApprovalCard,
  RequestApprovalCard,
} from '../../../src/components/approvals';
import { colors, fonts, radius, type } from '../../../src/theme';

type Queue = 'punches' | 'advances' | 'leave';

/** The full pending queues — same approve/decline pattern as the dashboard. */
export default function ApprovalsScreen() {
  const supervisor = useSupervisor();
  const [queue, setQueue] = useState<Queue>('punches');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const [punches, advances, leaves] = await Promise.all([
      fetchPendingTimeEntries(),
      fetchPendingCashAdvances(),
      fetchPendingLeaveRequests(),
    ]);
    return { punches, advances, leaves };
  }, [supervisor.id]);

  async function decide(fn: () => Promise<void>, id: string) {
    setBusyId(id);
    try {
      await fn();
      await reload();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Queue; label: string; count: number }[] = [
    { key: 'punches', label: 'Punches', count: data?.punches.length ?? 0 },
    { key: 'advances', label: 'Advances', count: data?.advances.length ?? 0 },
    { key: 'leave', label: 'Leave', count: data?.leaves.length ?? 0 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Approvals" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={[type.greet, { marginBottom: 14 }]}>Waiting on you</Text>

        <View style={s.filterRow}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setQueue(t.key)}
              style={[s.filterChip, queue === t.key && s.filterChipActive]}
            >
              <Text style={[s.filterText, queue === t.key && s.filterTextActive]}>
                {t.label} {t.count > 0 ? `(${t.count})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && !data ? (
          <Loader />
        ) : queue === 'punches' ? (
          <Section title="Pending time punches">
            {(data?.punches.length ?? 0) === 0 ? (
              <EmptyState
                title="No punches to review"
                body="New time in / time out records appear here the moment a worker submits one."
              />
            ) : (
              data!.punches.map((e) => (
                <PunchApprovalCard
                  key={e.id}
                  entry={e}
                  busy={busyId === e.id}
                  onDecide={(d) => decide(() => decideTimeEntry(e.id, d, supervisor.id), e.id)}
                />
              ))
            )}
          </Section>
        ) : queue === 'advances' ? (
          <Section title="Cash advance requests">
            {(data?.advances.length ?? 0) === 0 ? (
              <EmptyState
                title="No advance requests to show"
                body="Cash advances are decided by HR/Admin now. Amounts are not visible to supervisors."
              />
            ) : (
              data!.advances.map((a) => <CashAdvanceNoticeCard key={a.id} request={a} />)
            )}
          </Section>
        ) : (
          <Section title="Leave requests">
            {(data?.leaves.length ?? 0) === 0 ? (
              <EmptyState title="No leave requests" body="Leave filings from your workers land here." />
            ) : (
              data!.leaves.map((l) => (
                <RequestApprovalCard
                  key={l.id}
                  request={l}
                  busy={busyId === l.id}
                  onDecide={(d, r) =>
                    decide(() => decideLeaveRequest(l.id, d, supervisor.id, r), l.id)
                  }
                />
              ))
            )}
          </Section>
        )}
      </ScreenBody>
    </View>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.muted },
  filterTextActive: { color: colors.paper },
});

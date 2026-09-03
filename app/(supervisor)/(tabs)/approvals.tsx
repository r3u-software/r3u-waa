import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  decideLeaveRequest,
  decideTimeEntry,
  fetchPendingCashAdvances,
  fetchPendingLeaveRequests,
  fetchPendingTimeEntries,
  fetchRoster,
  reviewWorkerProfile,
} from '../../../src/lib/queries';
import { EmptyState } from '../../../src/components/ui';
import {
  CashAdvanceNoticeCard,
  ProfileApprovalCard,
  PunchApprovalCard,
  RequestApprovalCard,
} from '../../../src/components/approvals';
import { useWebTheme } from '../../../src/web/webTheme';
import { Chip, GlassPullScreen } from '../../../src/web/webUi';

type Queue = 'punches' | 'advances' | 'leave' | 'profiles';

/** The full pending queues — same approve/decline pattern as the dashboard. */
export default function ApprovalsScreen() {
  const supervisor = useSupervisor();
  const { palette } = useWebTheme();
  const [queue, setQueue] = useState<Queue>('punches');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const [punches, advances, leaves, roster] = await Promise.all([
      fetchPendingTimeEntries(),
      fetchPendingCashAdvances(),
      fetchPendingLeaveRequests(),
      fetchRoster(),
    ]);
    return { punches, advances, leaves, profiles: roster.filter((w) => w.status === 'pending') };
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
    { key: 'profiles', label: 'Profiles', count: data?.profiles.length ?? 0 },
    { key: 'advances', label: 'Advances', count: data?.advances.length ?? 0 },
    { key: 'leave', label: 'Leave', count: data?.leaves.length ?? 0 },
  ];

  return (
    <GlassPullScreen loading={loading} onRefresh={reload}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: 14 }}>Waiting on you</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 18 }}>
        {tabs.map((t) => (
          <Chip
            key={t.key}
            label={`${t.label}${t.count > 0 ? ` (${t.count})` : ''}`}
            active={queue === t.key}
            onPress={() => setQueue(t.key)}
          />
        ))}
      </ScrollView>

      {loading && !data ? (
        <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 16 }}>Loading…</Text>
      ) : queue === 'punches' ? (
        <View>
          <SectionTitle>Pending time punches</SectionTitle>
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
        </View>
      ) : queue === 'profiles' ? (
        <View>
          <SectionTitle>Identity submissions</SectionTitle>
          {(data?.profiles.length ?? 0) === 0 ? (
            <EmptyState
              title="Nothing to review"
              body="A worker's name, face scan, and ID land here together, once all three are on file."
            />
          ) : (
            data!.profiles.map((w) => (
              <ProfileApprovalCard
                key={w.id}
                worker={w}
                busy={busyId === w.id}
                onDecide={(d, r) => decide(() => reviewWorkerProfile(w.id, d === 'approve' ? 'approve' : 'reject', r), w.id)}
              />
            ))
          )}
        </View>
      ) : queue === 'advances' ? (
        <View>
          <SectionTitle>Cash advance requests</SectionTitle>
          {(data?.advances.length ?? 0) === 0 ? (
            <EmptyState
              title="No advance requests to show"
              body="Cash advances are decided by HR/Admin now. Amounts are not visible to supervisors."
            />
          ) : (
            data!.advances.map((a) => <CashAdvanceNoticeCard key={a.id} request={a} />)
          )}
        </View>
      ) : (
        <View>
          <SectionTitle>Leave requests</SectionTitle>
          {(data?.leaves.length ?? 0) === 0 ? (
            <EmptyState title="No leave requests" body="Leave filings from your workers land here." />
          ) : (
            data!.leaves.map((l) => (
              <RequestApprovalCard
                key={l.id}
                request={l}
                busy={busyId === l.id}
                onDecide={(d, r) => decide(() => decideLeaveRequest(l.id, d, supervisor.id, r), l.id)}
              />
            ))
          )}
        </View>
      )}
    </GlassPullScreen>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { palette } = useWebTheme();
  return <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>{children}</Text>;
}

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  decideLeaveRequest,
  decideTimeEntry,
  fetchPendingCashAdvances,
  fetchPendingLeaveRequests,
  fetchPendingTimeEntries,
  fetchRoster,
  fetchTodaysEntries,
} from '../../../src/lib/queries';
import { EmptyState } from '../../../src/components/ui';
import {
  CashAdvanceNoticeCard,
  PunchApprovalCard,
  RequestApprovalCard,
} from '../../../src/components/approvals';
import { longDate } from '../../../src/lib/format';
import { useWebTheme } from '../../../src/web/webTheme';
import { GlassCard, GlassPullScreen, MetricCard, WebPill, WebSection, WorkerCell } from '../../../src/web/webUi';

export default function SupervisorHome() {
  const supervisor = useSupervisor();
  const { palette } = useWebTheme();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const [punches, advances, leaves, roster, today] = await Promise.all([
      fetchPendingTimeEntries(),
      fetchPendingCashAdvances(),
      fetchPendingLeaveRequests(),
      fetchRoster(),
      fetchTodaysEntries(),
    ]);
    return { punches, advances, leaves, roster, today };
  }, [supervisor.id]);

  const stats = useMemo(() => {
    const presentToday = new Set(
      (data?.today ?? []).filter((e) => e.type === 'in').map((e) => e.worker_id)
    ).size;
    const awaiting =
      (data?.punches.length ?? 0) + (data?.advances.length ?? 0) + (data?.leaves.length ?? 0);
    const incomplete = (data?.roster ?? []).filter((w) => w.status !== 'complete').length;
    return { presentToday, awaiting, incomplete };
  }, [data]);

  /** Which site is each worker punched into right now (for the roster preview)? */
  const liveStatus = useMemo(() => {
    const map = new Map<string, 'in' | 'out'>();
    // today's entries come back newest-first, so the first hit per worker wins
    for (const e of data?.today ?? []) {
      if (!map.has(e.worker_id)) map.set(e.worker_id, e.type);
    }
    return map;
  }, [data?.today]);

  async function handlePunch(id: string, decision: 'approved' | 'declined') {
    setBusyId(id);
    try {
      await decideTimeEntry(id, decision, supervisor.id);
      await reload();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleLeave(id: string, decision: 'approved' | 'declined', remarks?: string) {
    setBusyId(id);
    try {
      await decideLeaveRequest(id, decision, supervisor.id, remarks);
      await reload();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  }

  const punchPreview = (data?.punches ?? []).slice(0, 2);
  const requestPreview = [
    ...(data?.advances ?? []).slice(0, 2).map((a) => ({ kind: 'advance' as const, req: a })),
    ...(data?.leaves ?? []).slice(0, 2).map((l) => ({ kind: 'leave' as const, req: l })),
  ].slice(0, 3);
  const rosterPreview = (data?.roster ?? []).slice(0, 5);

  return (
    <GlassPullScreen loading={loading} onRefresh={reload}>
      <Text style={{ fontSize: 11, letterSpacing: 1, color: palette.muted, fontWeight: '700' }}>
        {longDate().toUpperCase()}
      </Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginTop: 3 }}>
        Morning, {supervisor.full_name.split(' ')[0]}
      </Text>
      <Text style={{ fontSize: 13, color: palette.muted, marginTop: 2, marginBottom: 16 }}>
        {data?.roster.length ?? 0} worker{(data?.roster.length ?? 0) === 1 ? '' : 's'} under you
      </Text>

      <View style={{ flexDirection: 'row', gap: 9, marginBottom: 22 }}>
        <MetricCard style={{ flex: 1, padding: 12 }} label="Present today" value={String(stats.presentToday)} trendPct={null} />
        <MetricCard style={{ flex: 1, padding: 12 }} label="Awaiting review" value={String(stats.awaiting)} trendPct={null} />
        <MetricCard style={{ flex: 1, padding: 12 }} label="Incomplete" value={String(stats.incomplete)} trendPct={null} />
      </View>

      {/* --------------------------- Pending punches -------------------- */}
      <WebSection
        title="Pending time punches"
        link={data?.punches.length ? `${data.punches.length} total` : undefined}
        onLinkPress={() => router.push('/(supervisor)/(tabs)/approvals')}
      >
        {loading && !data ? (
          <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 16 }}>Loading…</Text>
        ) : punchPreview.length === 0 ? (
          <EmptyState title="Nothing to review" body="New punches appear here as workers clock in." />
        ) : (
          punchPreview.map((e) => (
            <PunchApprovalCard
              key={e.id}
              entry={e}
              busy={busyId === e.id}
              onDecide={(d) => handlePunch(e.id, d)}
            />
          ))
        )}
      </WebSection>

      {/* ------------------------------- Requests ----------------------- */}
      <WebSection title="Requests" link="See all" onLinkPress={() => router.push('/(supervisor)/(tabs)/approvals')}>
        {requestPreview.length === 0 ? (
          <EmptyState title="No open requests" body="Cash advances and leave filings land here." />
        ) : (
          requestPreview.map((item) =>
            item.kind === 'advance' ? (
              <CashAdvanceNoticeCard key={`a-${item.req.id}`} request={item.req} />
            ) : (
              <RequestApprovalCard
                key={`l-${item.req.id}`}
                request={item.req}
                busy={busyId === item.req.id}
                onDecide={(d, r) => handleLeave(item.req.id, d, r)}
              />
            )
          )
        )}
      </WebSection>

      {/* ----------------------------- Team roster ---------------------- */}
      <WebSection title="Team roster" link="Add worker" onLinkPress={() => router.push('/(supervisor)/register-worker')}>
        {rosterPreview.length === 0 ? (
          <EmptyState title="No workers yet" body="Register your first worker to issue their login credentials." />
        ) : (
          <GlassCard style={{ padding: 0 }}>
            {rosterPreview.map((w, i) => {
              const live = liveStatus.get(w.id);
              const label = w.status !== 'complete' ? 'Incomplete' : live === 'in' ? 'In' : live === 'out' ? 'Out' : 'Off';
              const tone: 'bad' | 'good' | 'muted' = w.status !== 'complete' ? 'bad' : live === 'in' ? 'good' : 'muted';
              return (
                <Pressable
                  key={w.id}
                  onPress={() => router.push(`/(supervisor)/worker/${w.id}`)}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 13,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: palette.border,
                    },
                    pressed && { backgroundColor: palette.hover },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <WorkerCell name={w.full_name} sub={w.phone || 'No phone on file'} />
                  </View>
                  <WebPill label={label} tone={tone} />
                </Pressable>
              );
            })}
          </GlassCard>
        )}
      </WebSection>
    </GlassPullScreen>
  );
}

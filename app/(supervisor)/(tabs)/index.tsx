import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import { Card, EmptyState, Loader, Pill, Section, StatusStrip } from '../../../src/components/ui';
import {
  CashAdvanceNoticeCard,
  PunchApprovalCard,
  RequestApprovalCard,
} from '../../../src/components/approvals';
import { colors, fonts, radius, type } from '../../../src/theme';
import { initialsOf, longDate } from '../../../src/lib/format';

export default function SupervisorHome() {
  const supervisor = useSupervisor();
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
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Supervisor" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.eyebrow}>{longDate()}</Text>
        <Text style={type.greet}>Morning, {supervisor.full_name.split(' ')[0]}</Text>
        <Text style={[type.subgreet, { marginBottom: 20 }]}>
          {data?.roster.length ?? 0} worker{(data?.roster.length ?? 0) === 1 ? '' : 's'} under you
        </Text>

        <StatusStrip
          chips={[
            { value: stats.presentToday, label: 'Present today', tone: 'ok' },
            { value: stats.awaiting, label: 'Awaiting review', tone: 'pending' },
            { value: stats.incomplete, label: 'Incomplete profile', tone: 'warn' },
          ]}
        />

        {/* --------------------------- Pending punches -------------------- */}
        <Section
          title="Pending time punches"
          link={data?.punches.length ? `${data.punches.length} total` : undefined}
          onLinkPress={() => router.push('/(supervisor)/(tabs)/approvals')}
        >
          {loading && !data ? (
            <Loader />
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
        </Section>

        {/* ------------------------------- Requests ----------------------- */}
        <Section
          title="Requests"
          link="See all"
          onLinkPress={() => router.push('/(supervisor)/(tabs)/approvals')}
        >
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
        </Section>

        {/* ----------------------------- Team roster ---------------------- */}
        <Section
          title="Team roster"
          link="Add worker"
          onLinkPress={() => router.push('/(supervisor)/register-worker')}
        >
          {rosterPreview.length === 0 ? (
            <EmptyState
              title="No workers yet"
              body="Register your first worker to issue their login credentials."
            />
          ) : (
            <Card>
              {rosterPreview.map((w, i) => {
                const live = liveStatus.get(w.id);
                const label =
                  w.status !== 'complete' ? 'Incomplete' : live === 'in' ? 'In' : live === 'out' ? 'Out' : 'Off';
                const tone =
                  w.status !== 'complete' ? 'warn' : live === 'in' ? 'ok' : 'muted';
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => router.push(`/(supervisor)/worker/${w.id}`)}
                    style={[s.rosterRow, i === rosterPreview.length - 1 && s.rosterRowLast]}
                  >
                    <View style={s.rosterAvatar}>
                      <Text style={s.rosterInitials}>{initialsOf(w.full_name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rosterName}>{w.full_name}</Text>
                      <Text style={s.rosterRole}>{w.phone || 'No phone on file'}</Text>
                    </View>
                    <Pill label={label} tone={tone} />
                  </Pressable>
                );
              })}
            </Card>
          )}
        </Section>
      </ScreenBody>
    </View>
  );
}

const s = StyleSheet.create({
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rosterRowLast: { borderBottomWidth: 0 },
  rosterAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterInitials: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.steel },
  rosterName: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.ink },
  rosterRole: { fontSize: 11, color: colors.muted, fontFamily: fonts.body },
});

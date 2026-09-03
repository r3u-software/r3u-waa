import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession, useWorker } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchWorkerAssignments,
  fetchWorkerCashAdvances,
  fetchWorkerLeaveRequests,
  fetchWorkerTimeEntries,
} from '../../../src/lib/queries';
import { EmptyState, Pill } from '../../../src/components/ui';
import {
  CalendarIcon,
  CashIcon,
  ChevronDownIcon,
  CurrencyIcon,
  ExitIcon,
  LockIcon,
  PlusIcon,
  SiteGlyph,
  UserIcon,
} from '../../../src/components/icons';
import { toneForStatus } from '../../../src/theme';
import { currentCutoff, longDate, peso, relativeStamp, timeOfDay } from '../../../src/lib/format';
import { useWebTheme } from '../../../src/web/webTheme';
import {
  GlassButton,
  GlassCard,
  GlassListRow,
  GlassOutlineButton,
  GlassScreen,
  MetricCard,
  webToneFor,
} from '../../../src/web/webUi';

export default function WorkerHome() {
  const worker = useWorker();
  const { refreshProfile } = useSession();
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();
  const [siteModal, setSiteModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const [assignments, entries, advances, leaves] = await Promise.all([
      fetchWorkerAssignments(worker.id),
      fetchWorkerTimeEntries(worker.id, 20),
      fetchWorkerCashAdvances(worker.id),
      fetchWorkerLeaveRequests(worker.id),
    ]);
    return { assignments, entries, advances, leaves };
  }, [worker.id]);

  const assignments = data?.assignments ?? [];
  const entries = data?.entries ?? [];
  const primary = assignments.find((a) => a.is_primary) ?? assignments[0];

  const selected = useMemo(
    () => assignments.find((a) => a.project_id === selectedProjectId) ?? primary,
    [assignments, selectedProjectId, primary]
  );
  const isBorrowed = Boolean(selected && primary && selected.project_id !== primary.project_id);

  /* --- Status strip: days this cutoff / pending review / flagged --------- */
  const stats = useMemo(() => {
    const { start, end } = currentCutoff();
    const inCutoff = entries.filter((e) => {
      const t = new Date(e.entry_timestamp);
      return t >= start && t <= end;
    });
    const days = new Set(
      inCutoff
        .filter((e) => e.status === 'approved' && e.type === 'in')
        .map((e) => new Date(e.entry_timestamp).toDateString())
    ).size;
    const pending = entries.filter((e) => e.status === 'pending').length;
    const flagged = entries.filter((e) => e.status === 'declined').length;
    return { days, pending, flagged };
  }, [entries]);

  const lastPunch = entries[0];

  /* --- Recent activity: punches + requests, newest first ---------------- */
  const activity = useMemo(() => {
    type Item = {
      key: string;
      title: string;
      sub: string;
      status: string;
      at: string;
      kind: 'punch' | 'advance' | 'leave';
    };
    const items: Item[] = [
      ...entries.slice(0, 6).map((e) => ({
        key: `t-${e.id}`,
        title: `Time ${e.type} — ${e.project?.name ?? 'Site'}`,
        sub: `${relativeStamp(e.entry_timestamp)}${
          e.status === 'pending' ? ' · Waiting on supervisor review' : ''
        }`,
        status: e.status,
        at: e.entry_timestamp,
        kind: 'punch' as const,
      })),
      ...(data?.advances ?? []).slice(0, 4).map((a) => ({
        key: `a-${a.id}`,
        title: `Cash advance ${a.money ? peso(a.money.amount) : ''}`.trim(),
        sub: a.money?.decline_remarks
          ? `Declined: ${a.money.decline_remarks}`
          : a.reason || 'No reason given',
        status: a.status,
        at: a.created_at,
        kind: 'advance' as const,
      })),
      ...(data?.leaves ?? []).slice(0, 4).map((l) => ({
        key: `l-${l.id}`,
        title: `${l.leave_type} leave`,
        sub: l.decline_remarks ? `Declined: ${l.decline_remarks}` : l.reason || 'Filed',
        status: l.status,
        at: l.created_at,
        kind: 'leave' as const,
      })),
    ];
    return items.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 6);
  }, [entries, data?.advances, data?.leaves]);

  function goPunch(type: 'in' | 'out') {
    if (!selected) return;
    router.push({
      pathname: '/(worker)/punch',
      params: { type, projectId: selected.project_id, projectName: selected.project?.name ?? 'Site' },
    });
  }

  const profileIncomplete = worker.status === 'incomplete';
  const profilePending = worker.status === 'pending';

  return (
    <GlassScreen>
      <ScrollBody
        insetsTop={insets.top}
        refreshing={loading}
        onRefresh={() => {
          reload();
          refreshProfile();
        }}
      >
        <Text style={{ fontSize: 11, letterSpacing: 1, color: palette.muted, fontWeight: '700' }}>
          {longDate()}
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '700', color: palette.text, marginTop: 3 }}>
          Hey, {worker.full_name.split(' ')[0]}
        </Text>
        <Text style={{ fontSize: 13, color: palette.muted, marginTop: 3, marginBottom: 18 }}>
          {profileIncomplete
            ? 'Profile incomplete · finish onboarding'
            : profilePending
              ? 'Profile submitted · awaiting supervisor review'
              : 'Profile complete · Verified'}
        </Text>

        {profileIncomplete ? (
          <GlassCard onPress={() => router.push('/(worker)/onboarding')} style={{ marginBottom: 16, borderColor: palette.accent }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>Finish your profile</Text>
            <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17, marginTop: 3 }}>
              Add your name, a face scan, and a valid ID so your punches can be verified. Tap to continue.
            </Text>
          </GlassCard>
        ) : profilePending ? (
          <GlassCard onPress={() => router.push('/(worker)/onboarding')} style={{ marginBottom: 16, borderColor: palette.info }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>Awaiting supervisor review</Text>
            <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17, marginTop: 3 }}>
              Your name, face scan, and ID are submitted and locked until your supervisor decides.
            </Text>
          </GlassCard>
        ) : null}

        <View style={s.statRow}>
          <MetricCard style={s.statItem} label="Days this cutoff" value={String(stats.days)} trendPct={null} />
          <MetricCard style={s.statItem} label="Pending review" value={String(stats.pending)} trendPct={null} />
          <MetricCard style={s.statItem} label="Flagged" value={String(stats.flagged)} trendPct={null} />
        </View>

        {/* ---------------------------- Punch card hero ------------------- */}
        <GlassCard style={{ marginBottom: 16, padding: 20 }}>
          <Text style={{ fontSize: 10.5, letterSpacing: 1, color: palette.muted, fontWeight: '700', marginBottom: 9 }}>
            WORKING TODAY AT
          </Text>
          <Pressable
            style={[s.siteSelect, { backgroundColor: palette.hover, borderColor: palette.border }]}
            onPress={() => setSiteModal(true)}
            disabled={assignments.length === 0}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
              <Text style={{ color: palette.text, fontSize: 14.5, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                {selected?.project?.name ?? 'No site assigned'}
              </Text>
              {isBorrowed ? (
                <View style={{ backgroundColor: palette.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}>
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700', letterSpacing: 0.3 }}>Borrowed</Text>
                </View>
              ) : null}
            </View>
            <ChevronDownIcon size={14} color={palette.muted} />
          </Pressable>

          <View style={s.punchRow}>
            <GlassButton label="Time In" onPress={() => goPunch('in')} disabled={!selected} style={{ flex: 1 }} />
            <GlassOutlineButton label="Time Out" onPress={() => goPunch('out')} disabled={!selected} style={{ flex: 1 }} />
          </View>

          <View style={[s.punchMeta, { borderTopColor: palette.border }]}>
            <Text style={{ fontSize: 11.5, color: palette.muted, flexShrink: 1 }}>
              Last punch: <Text style={{ color: palette.text, fontWeight: '700' }}>{lastPunch ? timeOfDay(lastPunch.entry_timestamp) : '—'}</Text>
            </Text>
            <Text style={{ fontSize: 11.5, color: palette.muted, flexShrink: 1 }} numberOfLines={1}>
              {selected?.project?.location ?? 'Location on file'}
            </Text>
          </View>
        </GlassCard>

        <View style={[s.bioNote, { backgroundColor: palette.panel, borderColor: palette.border }]}>
          <LockIcon size={20} color={palette.muted} />
          <Text style={{ flex: 1, fontSize: 11.5, color: palette.muted, lineHeight: 17 }}>
            Every punch needs a selfie + <Text style={{ color: palette.text, fontWeight: '700' }}>your phone's fingerprint or passcode</Text> to
            confirm it's really you clocking in.
          </Text>
        </View>

        {/* ------------------------------ Quick actions ------------------- */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>Quick actions</Text>
        <View style={s.quickGrid}>
          <QuickItem icon={<CashIcon size={16} color={palette.text} />} label="Cash advance" onPress={() => router.push('/(worker)/cash-advance')} />
          <QuickItem icon={<CalendarIcon size={16} color={palette.text} />} label="File leave" onPress={() => router.push('/(worker)/leave')} />
          <QuickItem icon={<CurrencyIcon size={16} color={palette.text} />} label="Cutoff pay" onPress={() => router.push('/(worker)/(tabs)/pay')} />
          <QuickItem icon={<UserIcon size={16} color={palette.text} />} label="My profile" onPress={() => router.push('/(worker)/(tabs)/profile')} />
        </View>

        {/* ---------------------------- Recent activity ------------------- */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Recent activity</Text>
          <Pressable onPress={() => router.push('/(worker)/(tabs)/activity')} hitSlop={8}>
            <Text style={{ fontSize: 11.5, color: palette.accent2, fontWeight: '700' }}>See all</Text>
          </Pressable>
        </View>
        {activity.length === 0 ? (
          <EmptyState title="Nothing yet" body="Your punches and requests will show up here once you start." />
        ) : (
          activity.map((item) => {
            const tone = webToneFor(toneForStatus(item.status));
            return (
              <GlassListRow
                key={item.key}
                icon={
                  item.kind === 'punch' ? (
                    <SiteGlyph size={17} color={palette.text} />
                  ) : item.kind === 'advance' ? (
                    <CashIcon size={17} color={palette.text} />
                  ) : (
                    <CalendarIcon size={17} color={palette.text} />
                  )
                }
                title={item.title}
                subtitle={item.sub}
                tone={tone}
                pillLabel={item.status}
              />
            );
          })
        )}
      </ScrollBody>

      {/* ------------------------------- Site picker --------------------- */}
      <Modal visible={siteModal} transparent animationType="slide" onRequestClose={() => setSiteModal(false)}>
        <Pressable style={s.backdrop} onPress={() => setSiteModal(false)}>
          <Pressable style={[s.sheet, { backgroundColor: palette.panelSolid, borderColor: palette.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 12 }}>
              Where are you working today?
            </Text>
            {assignments.length === 0 ? (
              <EmptyState title="No sites assigned" body="Ask your supervisor to assign you to a site." />
            ) : (
              assignments.map((a) => {
                const active = a.project_id === selected?.project_id;
                return (
                  <Pressable
                    key={a.id}
                    style={[
                      s.sheetRow,
                      { backgroundColor: palette.panel, borderColor: active ? palette.accent : palette.border, borderWidth: active ? 2 : 1 },
                    ]}
                    onPress={() => {
                      setSelectedProjectId(a.project_id);
                      setSiteModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>{a.project?.name ?? 'Site'}</Text>
                      {a.project?.location ? (
                        <Text style={{ fontSize: 11.5, color: palette.muted, marginTop: 2 }}>{a.project.location}</Text>
                      ) : null}
                    </View>
                    {a.is_primary ? <Pill label="Primary" tone="muted" /> : <Pill label="Borrowed" tone="pending" />}
                  </Pressable>
                );
              })
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </GlassScreen>
  );
}

/** Plain ScrollView with the safe-area top padding this screen used to get
 * from the shared `TopBar` (not used here — see the comment on `WorkerHome`
 * above) and a `RefreshControl` matching `ScreenBody`'s. */
function ScrollBody({
  insetsTop,
  refreshing,
  onRefresh,
  children,
}: {
  insetsTop: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}) {
  const { palette } = useWebTheme();
  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingTop: insetsTop + 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={palette.muted} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

function QuickItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const { palette } = useWebTheme();
  return (
    <GlassCard onPress={onPress} style={s.quickItem}>
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: palette.hover, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ fontSize: 10.5, fontWeight: '700', textAlign: 'center', color: palette.text, lineHeight: 13, marginTop: 7 }}>
        {label}
      </Text>
    </GlassCard>
  );
}

const s = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
  statItem: { flex: 1, padding: 12 },
  siteSelect: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  punchRow: { flexDirection: 'row', gap: 10 },
  punchMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  bioNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 22,
  },
  quickGrid: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  quickItem: { flex: 1, paddingVertical: 14, paddingHorizontal: 4, alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 40,
    gap: 10,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14 },
});

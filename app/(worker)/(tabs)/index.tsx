import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession, useWorker } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchWorkerAssignments,
  fetchWorkerCashAdvances,
  fetchWorkerLeaveRequests,
  fetchWorkerTimeEntries,
} from '../../../src/lib/queries';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import {
  Card,
  EmptyState,
  ListCard,
  Loader,
  Pill,
  Section,
  StatusStrip,
} from '../../../src/components/ui';
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
import { colors, fonts, radius, spacing, toneForStatus, type } from '../../../src/theme';
import { currentCutoff, longDate, peso, relativeStamp, timeOfDay } from '../../../src/lib/format';

export default function WorkerHome() {
  const worker = useWorker();
  const { refreshProfile } = useSession();
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

  const profileIncomplete = worker.status !== 'complete';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Attendance" />
      <ScreenBody
        refreshing={loading}
        onRefresh={() => {
          reload();
          refreshProfile();
        }}
      >
        <Text style={type.eyebrow}>{longDate()}</Text>
        <Text style={type.greet}>Hey, {worker.full_name.split(' ')[0]}</Text>
        <Text style={[type.subgreet, { marginBottom: spacing.xl }]}>
          {profileIncomplete ? 'Profile incomplete · finish onboarding' : 'Profile complete · Verified'}
        </Text>

        {profileIncomplete ? (
          <Card
            style={s.alert}
            onPress={() => router.push('/(worker)/onboarding')}
          >
            <Text style={s.alertTitle}>Finish your profile</Text>
            <Text style={s.alertBody}>
              Add your face scan and a valid ID so your punches can be verified. Tap to continue.
            </Text>
          </Card>
        ) : null}

        <StatusStrip
          chips={[
            { value: stats.days, label: 'Days this cutoff', tone: 'ok' },
            { value: stats.pending, label: 'Pending review', tone: 'pending' },
            { value: stats.flagged, label: 'Flagged', tone: 'warn' },
          ]}
        />

        {/* ---------------------------- Punch card hero ------------------- */}
        <View style={s.punchCard}>
          <View style={s.glow} />
          <Text style={s.siteLbl}>Working today at</Text>
          <Pressable
            style={s.siteSelect}
            onPress={() => setSiteModal(true)}
            disabled={assignments.length === 0}
          >
            <View style={s.siteSelectLeft}>
              <Text style={s.siteName} numberOfLines={1}>
                {selected?.project?.name ?? 'No site assigned'}
              </Text>
              {isBorrowed ? (
                <View style={s.tag}>
                  <Text style={s.tagText}>Borrowed</Text>
                </View>
              ) : null}
            </View>
            <ChevronDownIcon size={14} color="#fff" />
          </Pressable>

          <View style={s.punchRow}>
            <Pressable
              style={[s.punchBtn, s.punchIn]}
              onPress={() => goPunch('in')}
              disabled={!selected}
            >
              <PlusIcon size={20} color={colors.ink} />
              <Text style={s.punchInText}>Time In</Text>
            </Pressable>
            <Pressable
              style={[s.punchBtn, s.punchOut]}
              onPress={() => goPunch('out')}
              disabled={!selected}
            >
              <ExitIcon size={20} color="#fff" />
              <Text style={s.punchOutText}>Time Out</Text>
            </Pressable>
          </View>

          <View style={s.punchMeta}>
            <Text style={s.metaText}>
              Last punch:{' '}
              <Text style={s.metaStrong}>
                {lastPunch ? timeOfDay(lastPunch.entry_timestamp) : '—'}
              </Text>
            </Text>
            <Text style={s.metaText} numberOfLines={1}>
              {selected?.project?.location ?? 'Location on file'}
            </Text>
          </View>
        </View>

        <View style={s.bioNote}>
          <LockIcon size={20} color={colors.steel} />
          <Text style={s.bioText}>
            Every punch needs a selfie + <Text style={s.bioStrong}>your phone's fingerprint or passcode</Text> to
            confirm it's really you clocking in.
          </Text>
        </View>

        {/* ------------------------------ Quick actions ------------------- */}
        <Section title="Quick actions">
          <View style={s.quickGrid}>
            <QuickItem
              icon={<CashIcon size={16} color={colors.steel} />}
              label="Cash advance"
              onPress={() => router.push('/(worker)/cash-advance')}
            />
            <QuickItem
              icon={<CalendarIcon size={16} color={colors.steel} />}
              label="File leave"
              onPress={() => router.push('/(worker)/leave')}
            />
            <QuickItem
              icon={<CurrencyIcon size={16} color={colors.steel} />}
              label="Cutoff pay"
              onPress={() => router.push('/(worker)/(tabs)/pay')}
            />
            <QuickItem
              icon={<UserIcon size={16} color={colors.steel} />}
              label="My profile"
              onPress={() => router.push('/(worker)/(tabs)/profile')}
            />
          </View>
        </Section>

        {/* ---------------------------- Recent activity ------------------- */}
        <Section
          title="Recent activity"
          link="See all"
          onLinkPress={() => router.push('/(worker)/(tabs)/activity')}
        >
          {loading && activity.length === 0 ? (
            <Loader />
          ) : activity.length === 0 ? (
            <EmptyState
              title="Nothing yet"
              body="Your punches and requests will show up here once you start."
            />
          ) : (
            activity.map((item) => {
              const tone = toneForStatus(item.status);
              const bg =
                tone === 'ok' ? colors.okBg : tone === 'pending' ? colors.pendingBg : tone === 'warn' ? colors.warnBg : colors.neutralBg;
              const fg =
                tone === 'ok' ? colors.ok : tone === 'pending' ? colors.safetyDeep : tone === 'warn' ? colors.warn : colors.muted;
              return (
                <ListCard
                  key={item.key}
                  iconBg={bg}
                  icon={
                    item.kind === 'punch' ? (
                      <SiteGlyph size={17} color={fg} />
                    ) : item.kind === 'advance' ? (
                      <CashIcon size={17} color={fg} />
                    ) : (
                      <CalendarIcon size={17} color={fg} />
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
        </Section>
      </ScreenBody>

      {/* ------------------------------- Site picker --------------------- */}
      <Modal visible={siteModal} transparent animationType="slide" onRequestClose={() => setSiteModal(false)}>
        <Pressable style={s.backdrop} onPress={() => setSiteModal(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Where are you working today?</Text>
            {assignments.length === 0 ? (
              <EmptyState title="No sites assigned" body="Ask your supervisor to assign you to a site." />
            ) : (
              assignments.map((a) => {
                const active = a.project_id === selected?.project_id;
                return (
                  <Pressable
                    key={a.id}
                    style={[s.sheetRow, active && s.sheetRowActive]}
                    onPress={() => {
                      setSelectedProjectId(a.project_id);
                      setSiteModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.sheetRowName}>{a.project?.name ?? 'Site'}</Text>
                      {a.project?.location ? (
                        <Text style={s.sheetRowSub}>{a.project.location}</Text>
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
    </View>
  );
}

function QuickItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.quickItem, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <View style={s.quickIcon}>{icon}</View>
      <Text style={s.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  alert: { backgroundColor: colors.pendingBg, borderColor: colors.safety, gap: 3 },
  alertTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  alertBody: { fontSize: 12, color: colors.safetyDeep, lineHeight: 17, fontFamily: fonts.body },

  punchCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.hero,
    padding: spacing.xl,
    marginBottom: 22,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(242,169,59,0.14)',
  },
  siteLbl: {
    fontSize: 10.5,
    letterSpacing: 1,
    color: colors.mutedOnDark,
    marginBottom: spacing.sm,
    fontFamily: fonts.bodySemi,
  },
  siteSelect: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 8,
  },
  siteSelectLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  siteName: { color: '#fff', fontSize: 14.5, fontFamily: fonts.bodySemi, flexShrink: 1 },
  tag: { backgroundColor: colors.safety, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  tagText: { fontSize: 10, color: colors.ink, fontFamily: fonts.bodyBold, letterSpacing: 0.3 },
  punchRow: { flexDirection: 'row', gap: 10 },
  punchBtn: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  punchIn: { backgroundColor: colors.safety },
  punchOut: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  punchInText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 14 },
  punchOutText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 14 },
  punchMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    gap: 10,
  },
  metaText: { fontSize: 11.5, color: colors.mutedOnDark, fontFamily: fonts.body, flexShrink: 1 },
  metaStrong: { color: '#fff', fontFamily: fonts.bodySemi },

  bioNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 13,
    marginBottom: 22,
  },
  bioText: { flex: 1, fontSize: 11.5, color: colors.muted, lineHeight: 17, fontFamily: fonts.body },
  bioStrong: { color: colors.ink, fontFamily: fonts.bodySemi },

  quickGrid: { flexDirection: 'row', gap: 10 },
  quickItem: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 7,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 10.5,
    fontFamily: fonts.bodySemi,
    textAlign: 'center',
    color: colors.ink,
    lineHeight: 13,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,27,24,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: spacing.xl,
    paddingBottom: 40,
    gap: 10,
  },
  sheetTitle: {
    fontFamily: fonts.serif,
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
  },
  sheetRowActive: { borderColor: colors.safety, borderWidth: 2 },
  sheetRowName: { fontSize: 13.5, fontFamily: fonts.bodyBold, color: colors.ink },
  sheetRowSub: { fontSize: 11.5, color: colors.muted, marginTop: 2, fontFamily: fonts.body },
});

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useWorker } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchWorkerCashAdvances,
  fetchWorkerLeaveRequests,
  fetchWorkerTimeEntries,
} from '../../../src/lib/queries';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import { EmptyState, ListCard, Loader, Section } from '../../../src/components/ui';
import { CalendarIcon, CashIcon, SiteGlyph } from '../../../src/components/icons';
import { colors, fonts, radius, toneForStatus, type } from '../../../src/theme';
import { coords, dateRange, peso, relativeStamp } from '../../../src/lib/format';

type Filter = 'punches' | 'advances' | 'leave';

/** Full history of everything this worker has submitted. */
export default function WorkerActivity() {
  const worker = useWorker();
  const [filter, setFilter] = useState<Filter>('punches');

  const { data, loading, reload } = useAsync(async () => {
    const [entries, advances, leaves] = await Promise.all([
      fetchWorkerTimeEntries(worker.id, 100),
      fetchWorkerCashAdvances(worker.id),
      fetchWorkerLeaveRequests(worker.id),
    ]);
    return { entries, advances, leaves };
  }, [worker.id]);

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'punches', label: 'Punches', count: data?.entries.length ?? 0 },
    { key: 'advances', label: 'Advances', count: data?.advances.length ?? 0 },
    { key: 'leave', label: 'Leave', count: data?.leaves.length ?? 0 },
  ];

  function bgFor(status: string) {
    const t = toneForStatus(status);
    return t === 'ok'
      ? colors.okBg
      : t === 'pending'
        ? colors.pendingBg
        : t === 'warn'
          ? colors.warnBg
          : colors.neutralBg;
  }
  function fgFor(status: string) {
    const t = toneForStatus(status);
    return t === 'ok'
      ? colors.ok
      : t === 'pending'
        ? colors.safetyDeep
        : t === 'warn'
          ? colors.warn
          : colors.muted;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Activity" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={[type.greet, { marginBottom: 14 }]}>Your history</Text>

        <View style={s.filterRow}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setFilter(t.key)}
              style={[s.filterChip, filter === t.key && s.filterChipActive]}
            >
              <Text style={[s.filterText, filter === t.key && s.filterTextActive]}>
                {t.label} {t.count > 0 ? `(${t.count})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && !data ? (
          <Loader />
        ) : filter === 'punches' ? (
          <Section title="Time entries">
            {(data?.entries.length ?? 0) === 0 ? (
              <EmptyState title="No punches yet" body="Your time in and time out records land here." />
            ) : (
              data!.entries.map((e) => (
                <ListCard
                  key={e.id}
                  iconBg={bgFor(e.status)}
                  icon={<SiteGlyph size={17} color={fgFor(e.status)} />}
                  title={`Time ${e.type} — ${e.project?.name ?? 'Site'}`}
                  subtitle={`${relativeStamp(e.entry_timestamp)}\n${coords(e.gps_lat, e.gps_lng)}`}
                  tone={toneForStatus(e.status)}
                  pillLabel={e.status}
                />
              ))
            )}
          </Section>
        ) : filter === 'advances' ? (
          <Section title="Cash advances">
            {(data?.advances.length ?? 0) === 0 ? (
              <EmptyState title="No requests yet" body="File a cash advance from the home screen." />
            ) : (
              data!.advances.map((a) => (
                <ListCard
                  key={a.id}
                  iconBg={bgFor(a.status)}
                  icon={<CashIcon size={17} color={fgFor(a.status)} />}
                  title={`Cash advance ${a.money ? peso(a.money.amount) : ''}`.trim()}
                  subtitle={
                    a.status === 'declined' && a.money?.decline_remarks
                      ? `Declined: ${a.money.decline_remarks}`
                      : `${a.reason || 'No reason given'} · ${relativeStamp(a.created_at)}`
                  }
                  tone={toneForStatus(a.status)}
                  pillLabel={a.status}
                />
              ))
            )}
          </Section>
        ) : (
          <Section title="Leave requests">
            {(data?.leaves.length ?? 0) === 0 ? (
              <EmptyState title="No leave filed" body="File leave from the home screen." />
            ) : (
              data!.leaves.map((l) => (
                <ListCard
                  key={l.id}
                  iconBg={bgFor(l.status)}
                  icon={<CalendarIcon size={17} color={fgFor(l.status)} />}
                  title={`${l.leave_type} · ${dateRange(l.date_from, l.date_to)}`}
                  subtitle={
                    l.status === 'declined' && l.decline_remarks
                      ? `Declined: ${l.decline_remarks}`
                      : `${l.reason || 'No reason given'} · filed ${relativeStamp(l.created_at)}`
                  }
                  tone={toneForStatus(l.status)}
                  pillLabel={l.status}
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

import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorker } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchWorkerCashAdvances,
  fetchWorkerLeaveRequests,
  fetchWorkerTimeEntries,
} from '../../../src/lib/queries';
import { EmptyState } from '../../../src/components/ui';
import { CalendarIcon, CashIcon, SiteGlyph } from '../../../src/components/icons';
import { toneForStatus } from '../../../src/theme';
import { coords, dateRange, peso, relativeStamp } from '../../../src/lib/format';
import { useWebTheme } from '../../../src/web/webTheme';
import { Chip, GlassListRow, GlassScreen, webToneFor } from '../../../src/web/webUi';

type Filter = 'punches' | 'advances' | 'leave';

/** Full history of everything this worker has submitted. */
export default function WorkerActivity() {
  const worker = useWorker();
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();
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

  return (
    <GlassScreen>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.muted} />}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: 14 }}>Your history</Text>

        <View style={s.filterRow}>
          {tabs.map((t) => (
            <Chip
              key={t.key}
              label={`${t.label}${t.count > 0 ? ` (${t.count})` : ''}`}
              active={filter === t.key}
              onPress={() => setFilter(t.key)}
            />
          ))}
        </View>

        {loading && !data ? (
          <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 24 }}>Loading…</Text>
        ) : filter === 'punches' ? (
          <>
            <SectionTitle>Time entries</SectionTitle>
            {(data?.entries.length ?? 0) === 0 ? (
              <EmptyState title="No punches yet" body="Your time in and time out records land here." />
            ) : (
              data!.entries.map((e) => (
                <GlassListRow
                  key={e.id}
                  icon={<SiteGlyph size={17} color={palette.text} />}
                  title={`Time ${e.type} — ${e.project?.name ?? 'Site'}`}
                  subtitle={`${relativeStamp(e.entry_timestamp)} · ${coords(e.gps_lat, e.gps_lng)}`}
                  tone={webToneFor(toneForStatus(e.status))}
                  pillLabel={e.status}
                />
              ))
            )}
          </>
        ) : filter === 'advances' ? (
          <>
            <SectionTitle>Cash advances</SectionTitle>
            {(data?.advances.length ?? 0) === 0 ? (
              <EmptyState title="No requests yet" body="File a cash advance from the home screen." />
            ) : (
              data!.advances.map((a) => (
                <GlassListRow
                  key={a.id}
                  icon={<CashIcon size={17} color={palette.text} />}
                  title={`Cash advance ${a.money ? peso(a.money.amount) : ''}`.trim()}
                  subtitle={
                    a.status === 'declined' && a.money?.decline_remarks
                      ? `Declined: ${a.money.decline_remarks}`
                      : `${a.reason || 'No reason given'} · ${relativeStamp(a.created_at)}`
                  }
                  tone={webToneFor(toneForStatus(a.status))}
                  pillLabel={a.status}
                />
              ))
            )}
          </>
        ) : (
          <>
            <SectionTitle>Leave requests</SectionTitle>
            {(data?.leaves.length ?? 0) === 0 ? (
              <EmptyState title="No leave filed" body="File leave from the home screen." />
            ) : (
              data!.leaves.map((l) => (
                <GlassListRow
                  key={l.id}
                  icon={<CalendarIcon size={17} color={palette.text} />}
                  title={`${l.leave_type} · ${dateRange(l.date_from, l.date_to)}`}
                  subtitle={
                    l.status === 'declined' && l.decline_remarks
                      ? `Declined: ${l.decline_remarks}`
                      : `${l.reason || 'No reason given'} · filed ${relativeStamp(l.created_at)}`
                  }
                  tone={webToneFor(toneForStatus(l.status))}
                  pillLabel={l.status}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </GlassScreen>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { palette } = useWebTheme();
  return <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>{children}</Text>;
}

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
});

import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchWorkerAssignments,
  fetchWorkerById,
  fetchWorkerCashAdvanceRequests,
  fetchWorkerLeaveRequests,
  fetchWorkerTimeEntries,
  setEmploymentStatus,
  setWorkerContract,
} from '../../../src/lib/queries';
import type { EmploymentStatus } from '../../../src/lib/types';
import { pickPdf } from '../../../src/lib/capture';
import { uploadToBucket } from '../../../src/lib/storage';
import { EmptyState } from '../../../src/components/ui';
import { SignedImage } from '../../../src/components/SignedImage';
import { CalendarIcon, CashIcon, FileIcon, SiteGlyph } from '../../../src/components/icons';
import { toneForStatus } from '../../../src/theme';
import { coords, dateRange, initialsOf, relativeStamp } from '../../../src/lib/format';
import { useWebTheme } from '../../../src/web/webTheme';
import {
  GlassButton,
  GlassCard,
  GlassListRow,
  GlassOutlineButton,
  GlassScreen,
  MetricCard,
  WebPill,
  WebSection,
  webToneFor,
} from '../../../src/web/webUi';

/** The three separation reasons the supervisor may tag. */
const SEPARATION_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: 'terminated', label: 'Terminated' },
  { value: 'awol', label: 'AWOL' },
  { value: 'resigned', label: 'Resigned' },
];

/**
 * Worker detail for a supervisor: profile state, evidence on file, punch and
 * request history, the contract-PDF upload, and separation tagging.
 */
export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const supervisor = useSupervisor();
  const { palette } = useWebTheme();
  const [uploading, setUploading] = useState(false);
  const [tagging, setTagging] = useState(false);

  const { data, loading, reload } = useAsync(async () => {
    if (!id) return null;
    const [worker, assignments, entries, advances, leaves] = await Promise.all([
      fetchWorkerById(id),
      fetchWorkerAssignments(id),
      fetchWorkerTimeEntries(id, 40),
      // Requests only — no money join. Supervisors have no grant on
      // waa_cash_advance_money, so there is no amount to render here.
      fetchWorkerCashAdvanceRequests(id),
      fetchWorkerLeaveRequests(id),
    ]);
    return { worker, assignments, entries, advances, leaves };
  }, [id]);

  const worker = data?.worker;

  /**
   * Tags a separation. RLS already limits this to workers whose
   * `supervisor_id` is the caller's own — the same policy that lets a
   * supervisor attach a contract. Once tagged, the worker drops out of the
   * Team tab and the active roster on the next fetch, and the case is routed
   * to HR/Admin by a database trigger.
   */
  function confirmSeparation(status: EmploymentStatus, label: string) {
    if (!worker) return;
    Alert.alert(
      `Tag as ${label}?`,
      `${worker.full_name} will disappear from your roster and Team tab immediately. ` +
        'Their attendance history and any pending pay stay intact for HR/Admin to decide on. ' +
        'This is not a delete, but you cannot undo it yourself.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Tag ${label}`,
          style: 'destructive',
          onPress: async () => {
            setTagging(true);
            try {
              await setEmploymentStatus(worker.id, status, supervisor.id);
              Alert.alert(
                'Separation tagged',
                `${worker.full_name} is now marked ${label.toLowerCase()} and has been routed to HR/Admin.`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (e) {
              Alert.alert('Could not tag', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setTagging(false);
            }
          },
        },
      ]
    );
  }

  async function uploadContract() {
    if (!worker) return;
    const uri = await pickPdf();
    if (!uri) return;
    setUploading(true);
    try {
      const path = await uploadToBucket(
        'waa-contracts',
        worker.id,
        uri,
        'contract',
        'application/pdf'
      );
      await setWorkerContract(worker.id, path);
      await reload();
      Alert.alert('Contract uploaded', `${worker.full_name} can now read it from their profile.`);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  }

  if (loading && !data) {
    return (
      <GlassScreen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: palette.muted }}>Loading worker…</Text>
        </View>
      </GlassScreen>
    );
  }

  if (!worker) {
    return (
      <GlassScreen>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <EmptyState
            title="Worker not found"
            body="This worker may have been removed, or is not assigned to you."
          />
        </ScrollView>
      </GlassScreen>
    );
  }

  const entries = data?.entries ?? [];
  const pending = entries.filter((e) => e.status === 'pending').length;
  const approved = entries.filter((e) => e.status === 'approved').length;
  const declined = entries.filter((e) => e.status === 'declined').length;

  return (
    <GlassScreen>
      <Stack.Screen options={{ title: worker.full_name }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* ------------------------------- Header ----------------------- */}
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 20 }}>
          <LinearGradient
            colors={[palette.accent, palette.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 19 }}>{initialsOf(worker.full_name)}</Text>
          </LinearGradient>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{worker.full_name}</Text>
            <Text style={{ fontSize: 13, color: palette.muted }}>
              {worker.position ? `${worker.position} · ` : ''}
              {worker.phone || 'No phone on file'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              <WebPill label={worker.status} tone={webToneFor(toneForStatus(worker.status))} />
              {worker.employment_status !== 'active' ? (
                <WebPill label={worker.employment_status} tone={webToneFor(toneForStatus(worker.employment_status))} />
              ) : null}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 9, marginBottom: 16 }}>
          <MetricCard style={{ flex: 1, padding: 12 }} label="Approved punches" value={String(approved)} trendPct={null} />
          <MetricCard style={{ flex: 1, padding: 12 }} label="Awaiting review" value={String(pending)} trendPct={null} />
          <MetricCard style={{ flex: 1, padding: 12 }} label="Declined" value={String(declined)} trendPct={null} />
        </View>

        {/* ------------------------------ Evidence ---------------------- */}
        <WebSection title="Identity on file">
          <GlassCard>
            <View style={{ flexDirection: 'row', gap: 20 }}>
              <View style={{ alignItems: 'center', gap: 7 }}>
                <SignedImage bucket="waa-selfies" path={worker.face_scan_url} size={84} radius={12} />
                <Text style={{ fontSize: 11, color: palette.muted, fontWeight: '600' }}>
                  {worker.face_scan_url ? 'Face scan' : 'No face scan'}
                </Text>
              </View>
              <View style={{ alignItems: 'center', gap: 7 }}>
                <SignedImage bucket="waa-ids" path={worker.valid_id_url} size={84} radius={12} />
                <Text style={{ fontSize: 11, color: palette.muted, fontWeight: '600' }}>
                  {worker.valid_id_url ? 'Valid ID' : 'No valid ID'}
                </Text>
              </View>
            </View>
            {worker.status !== 'complete' ? (
              <Text style={{ fontSize: 11.5, color: palette.bad, lineHeight: 17, marginTop: 12 }}>
                This worker still needs to complete their profile before their identity can be
                verified.
              </Text>
            ) : null}
          </GlassCard>
        </WebSection>

        {/* ------------------------------- Sites ------------------------ */}
        <WebSection title="Site assignments">
          {(data?.assignments.length ?? 0) === 0 ? (
            <EmptyState title="No site assignments" />
          ) : (
            data!.assignments.map((a) => (
              <GlassListRow
                key={a.id}
                icon={<SiteGlyph size={17} color={palette.text} />}
                title={a.project?.name ?? 'Site'}
                subtitle={a.project?.location ?? undefined}
                tone={a.is_primary ? 'muted' : 'info'}
                pillLabel={a.is_primary ? 'Primary' : 'Borrowed'}
              />
            ))
          )}
        </WebSection>

        {/* ------------------------------ Contract ---------------------- */}
        <WebSection title="Contract">
          <GlassCard>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: palette.hover, alignItems: 'center', justifyContent: 'center' }}>
                <FileIcon size={20} color={worker.contract_pdf_url ? palette.accent2 : palette.muted} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                  {worker.contract_pdf_url ? 'Signed contract on file' : 'No contract uploaded'}
                </Text>
                <Text style={{ fontSize: 12, color: palette.muted }}>
                  The worker can read this from their profile but cannot edit or replace it.
                </Text>
              </View>
            </View>
            <GlassButton
              label={
                uploading
                  ? 'Uploading…'
                  : worker.contract_pdf_url
                    ? 'Replace contract PDF'
                    : 'Upload contract PDF'
              }
              onPress={uploadContract}
              loading={uploading}
              style={{ marginTop: 12 }}
            />
          </GlassCard>
        </WebSection>

        {/* ----------------------------- Punch log ---------------------- */}
        <WebSection title="Time entries">
          {entries.length === 0 ? (
            <EmptyState title="No punches yet" />
          ) : (
            entries.slice(0, 15).map((e) => (
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
        </WebSection>

        {/* ------------------------------ Requests ---------------------- */}
        <WebSection title="Requests">
          {(data?.advances.length ?? 0) === 0 && (data?.leaves.length ?? 0) === 0 ? (
            <EmptyState title="No requests filed" />
          ) : (
            <>
              {data!.advances.map((a) => (
                <GlassListRow
                  key={`a-${a.id}`}
                  icon={<CashIcon size={17} color={palette.text} />}
                  title="Cash advance requested"
                  subtitle={`${a.reason || 'No reason given'} · ${relativeStamp(a.created_at)}`}
                  tone={webToneFor(toneForStatus(a.status))}
                  pillLabel={a.status}
                />
              ))}
              {data!.leaves.map((l) => (
                <GlassListRow
                  key={`l-${l.id}`}
                  icon={<CalendarIcon size={17} color={palette.text} />}
                  title={`${l.leave_type} · ${dateRange(l.date_from, l.date_to)}`}
                  subtitle={`${l.reason || 'No reason given'} · ${relativeStamp(l.created_at)}`}
                  tone={webToneFor(toneForStatus(l.status))}
                  pillLabel={l.status}
                />
              ))}
            </>
          )}
        </WebSection>

        {/* ----------------------------- Separation --------------------- */}
        <WebSection title="Employment status">
          <GlassCard>
            {worker.employment_status === 'active' ? (
              <>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>Active</Text>
                <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2, lineHeight: 17 }}>
                  Tagging a separation removes this worker from your roster and Team tab
                  immediately and routes the case to HR/Admin, who decide by hand what happens to
                  any unfinalized pay. Their history and payslips are never deleted.
                </Text>
                <View style={{ marginTop: 14, gap: 8 }}>
                  {SEPARATION_OPTIONS.map((o) => (
                    <GlassOutlineButton
                      key={o.value}
                      label={`Tag as ${o.label}`}
                      disabled={tagging}
                      onPress={() => confirmSeparation(o.value, o.label)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>Separated</Text>
                  <WebPill label={worker.employment_status} tone={webToneFor(toneForStatus(worker.employment_status))} />
                </View>
                <Text style={{ fontSize: 12, color: palette.muted, marginTop: 6, lineHeight: 17 }}>
                  Tagged{' '}
                  {worker.employment_status_set_at
                    ? relativeStamp(worker.employment_status_set_at)
                    : 'previously'}
                  . HR/Admin owns this case now — contact the office to reinstate.
                </Text>
              </>
            )}
          </GlassCard>
        </WebSection>
      </ScrollView>
    </GlassScreen>
  );
}

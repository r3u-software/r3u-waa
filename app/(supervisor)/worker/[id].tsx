import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
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
import { ScreenBody } from '../../../src/components/Screen';
import {
  Card,
  EmptyState,
  ListCard,
  Loader,
  Pill,
  PrimaryButton,
  SecondaryButton,
  Section,
  StatusStrip,
} from '../../../src/components/ui';
import { SignedImage } from '../../../src/components/SignedImage';
import { CalendarIcon, CashIcon, FileIcon, SiteGlyph } from '../../../src/components/icons';
import { colors, fonts, radius, spacing, toneForStatus, type } from '../../../src/theme';
import { coords, dateRange, initialsOf, relativeStamp } from '../../../src/lib/format';

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
      <ScreenBody>
        <Loader label="Loading worker" />
      </ScreenBody>
    );
  }

  if (!worker) {
    return (
      <ScreenBody>
        <EmptyState
          title="Worker not found"
          body="This worker may have been removed, or is not assigned to you."
        />
      </ScreenBody>
    );
  }

  const entries = data?.entries ?? [];
  const pending = entries.filter((e) => e.status === 'pending').length;
  const approved = entries.filter((e) => e.status === 'approved').length;
  const declined = entries.filter((e) => e.status === 'declined').length;

  return (
    <>
      <Stack.Screen options={{ title: worker.full_name }} />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        {/* ------------------------------- Header ----------------------- */}
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initialsOf(worker.full_name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={type.greet}>{worker.full_name}</Text>
            <Text style={type.subgreet}>
              {worker.position ? `${worker.position} · ` : ''}
              {worker.phone || 'No phone on file'}
            </Text>
            <View style={s.pillRow}>
              <Pill label={worker.status} tone={toneForStatus(worker.status)} />
              {worker.employment_status !== 'active' ? (
                <Pill
                  label={worker.employment_status}
                  tone={toneForStatus(worker.employment_status)}
                />
              ) : null}
            </View>
          </View>
        </View>

        <StatusStrip
          chips={[
            { value: approved, label: 'Approved punches', tone: 'ok' },
            { value: pending, label: 'Awaiting review', tone: 'pending' },
            { value: declined, label: 'Declined', tone: 'warn' },
          ]}
        />

        {/* ------------------------------ Evidence ---------------------- */}
        <Section title="Identity on file">
          <Card>
            <View style={s.evidenceRow}>
              <View style={s.evidenceItem}>
                <SignedImage bucket="waa-selfies" path={worker.face_scan_url} size={84} radius={12} />
                <Text style={s.evidenceLabel}>
                  {worker.face_scan_url ? 'Face scan' : 'No face scan'}
                </Text>
              </View>
              <View style={s.evidenceItem}>
                <SignedImage bucket="waa-ids" path={worker.valid_id_url} size={84} radius={12} />
                <Text style={s.evidenceLabel}>{worker.valid_id_url ? 'Valid ID' : 'No valid ID'}</Text>
              </View>
            </View>
            {worker.status !== 'complete' ? (
              <Text style={s.incompleteNote}>
                This worker still needs to complete their profile before their identity can be
                verified.
              </Text>
            ) : null}
          </Card>
        </Section>

        {/* ------------------------------- Sites ------------------------ */}
        <Section title="Site assignments">
          {(data?.assignments.length ?? 0) === 0 ? (
            <EmptyState title="No site assignments" />
          ) : (
            data!.assignments.map((a) => (
              <ListCard
                key={a.id}
                iconBg={colors.neutralBg}
                icon={<SiteGlyph size={17} color={colors.steel} />}
                title={a.project?.name ?? 'Site'}
                subtitle={a.project?.location ?? undefined}
                tone={a.is_primary ? 'muted' : 'pending'}
                pillLabel={a.is_primary ? 'Primary' : 'Borrowed'}
              />
            ))
          )}
        </Section>

        {/* ------------------------------ Contract ---------------------- */}
        <Section title="Contract">
          <Card>
            <View style={s.contractRow}>
              <View style={s.contractIcon}>
                <FileIcon size={20} color={worker.contract_pdf_url ? colors.steel : colors.muted} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.cardTitle}>
                  {worker.contract_pdf_url ? 'Signed contract on file' : 'No contract uploaded'}
                </Text>
                <Text style={type.cardSub}>
                  The worker can read this from their profile but cannot edit or replace it.
                </Text>
              </View>
            </View>
            <PrimaryButton
              label={
                uploading
                  ? 'Uploading…'
                  : worker.contract_pdf_url
                    ? 'Replace contract PDF'
                    : 'Upload contract PDF'
              }
              onPress={uploadContract}
              loading={uploading}
              tone={worker.contract_pdf_url ? 'ink' : 'safety'}
              style={{ marginTop: 12 }}
            />
          </Card>
        </Section>

        {/* ----------------------------- Punch log ---------------------- */}
        <Section title="Time entries">
          {entries.length === 0 ? (
            <EmptyState title="No punches yet" />
          ) : (
            entries.slice(0, 15).map((e) => (
              <ListCard
                key={e.id}
                iconBg={
                  e.status === 'approved'
                    ? colors.okBg
                    : e.status === 'pending'
                      ? colors.pendingBg
                      : colors.warnBg
                }
                icon={
                  <SiteGlyph
                    size={17}
                    color={
                      e.status === 'approved'
                        ? colors.ok
                        : e.status === 'pending'
                          ? colors.safetyDeep
                          : colors.warn
                    }
                  />
                }
                title={`Time ${e.type} — ${e.project?.name ?? 'Site'}`}
                subtitle={`${relativeStamp(e.entry_timestamp)}\n${coords(e.gps_lat, e.gps_lng)}`}
                tone={toneForStatus(e.status)}
                pillLabel={e.status}
              />
            ))
          )}
        </Section>

        {/* ------------------------------ Requests ---------------------- */}
        <Section title="Requests">
          {(data?.advances.length ?? 0) === 0 && (data?.leaves.length ?? 0) === 0 ? (
            <EmptyState title="No requests filed" />
          ) : (
            <>
              {data!.advances.map((a) => (
                <ListCard
                  key={`a-${a.id}`}
                  iconBg={colors.neutralBg}
                  icon={<CashIcon size={17} color={colors.steel} />}
                  title="Cash advance requested"
                  subtitle={`${a.reason || 'No reason given'} · ${relativeStamp(a.created_at)}`}
                  tone={toneForStatus(a.status)}
                  pillLabel={a.status}
                />
              ))}
              {data!.leaves.map((l) => (
                <ListCard
                  key={`l-${l.id}`}
                  iconBg={colors.neutralBg}
                  icon={<CalendarIcon size={17} color={colors.steel} />}
                  title={`${l.leave_type} · ${dateRange(l.date_from, l.date_to)}`}
                  subtitle={`${l.reason || 'No reason given'} · ${relativeStamp(l.created_at)}`}
                  tone={toneForStatus(l.status)}
                  pillLabel={l.status}
                />
              ))}
            </>
          )}
        </Section>

        {/* ----------------------------- Separation --------------------- */}
        <Section title="Employment status">
          <Card>
            {worker.employment_status === 'active' ? (
              <>
                <Text style={type.cardTitle}>Active</Text>
                <Text style={[type.cardSub, { marginTop: 2 }]}>
                  Tagging a separation removes this worker from your roster and Team tab
                  immediately and routes the case to HR/Admin, who decide by hand what happens to
                  any unfinalized pay. Their history and payslips are never deleted.
                </Text>
                <View style={{ marginTop: 14, gap: 8 }}>
                  {SEPARATION_OPTIONS.map((o) => (
                    <SecondaryButton
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
                <View style={s.pillRow}>
                  <Text style={type.cardTitle}>Separated</Text>
                  <Pill
                    label={worker.employment_status}
                    tone={toneForStatus(worker.employment_status)}
                  />
                </View>
                <Text style={[type.cardSub, { marginTop: 4 }]}>
                  Tagged{' '}
                  {worker.employment_status_set_at
                    ? relativeStamp(worker.employment_status_set_at)
                    : 'previously'}
                  . HR/Admin owns this case now — contact the office to reinstate.
                </Text>
              </>
            )}
          </Card>
        </Section>
      </ScreenBody>
    </>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: spacing.xl },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 19 },
  evidenceRow: { flexDirection: 'row', gap: spacing.lg },
  evidenceItem: { alignItems: 'center', gap: 7 },
  evidenceLabel: { fontSize: 11, color: colors.muted, fontFamily: fonts.bodySemi },
  incompleteNote: {
    fontSize: 11.5,
    color: colors.warn,
    lineHeight: 17,
    marginTop: 12,
    fontFamily: fonts.body,
  },
  contractRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  contractIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

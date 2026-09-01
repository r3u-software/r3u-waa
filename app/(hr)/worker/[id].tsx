/*
 * ORPHANED SCREEN — not reachable from the app's navigation.
 *
 * The full HR/Admin worker detail + editing screen.
 *
 * Per HR-ADMIN-MOBILE-ACCESS-ADDENDUM.md (resolved as Option A in
 * ADDENDA-PROPOSAL.md), HR/Admin's mobile surface is now exactly three
 * single-decision actions plus Notifications and Profile. This screen belongs
 * to the full HR/Admin surface, which lives on the web dashboard — so nothing
 * in the tab bar or any link points at it any more.
 *
 * It is kept, unwired, as a starting point for that separate web dashboard.
 * As written it CANNOT WORK on mobile: it queries `waa_workers`, `waa_worker_pay`, `waa_worker_deductions` and `waa_time_entries` directly, and
 * HR/Admin's direct-table RLS grants on those were revoked. Rebuilding it for
 * the web means rewiring every query here onto purpose-built edge functions
 * first.
 */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHrAdmin } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchDeductionTypes,
  fetchWorkerById,
  fetchWorkerDeductions,
  fetchWorkerLeavePay,
  fetchWorkerLeavePayTypes,
  fetchWorkerPay,
  setLeavePayMaster,
  setLeavePayType,
  setWorkerDeduction,
  updateWorkerPosition,
  upsertWorkerPay,
} from '../../../src/lib/queries';
import { ScreenBody } from '../../../src/components/Screen';
import {
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Loader,
  Pill,
  PrimaryButton,
  Section,
} from '../../../src/components/ui';
import { colors, fonts, radius, spacing, toneForStatus, type } from '../../../src/theme';
import { initialsOf, peso, relativeStamp } from '../../../src/lib/format';

/** The leave types the worker-facing filing screen offers. */
const LEAVE_TYPES = ['Sick', 'Vacation', 'Emergency', 'Campaign'];

/**
 * HR/Admin worker detail — the home for every per-worker payroll setting.
 *
 * These are per-person exceptions to the org-wide baselines on the Settings
 * screen: the hourly rate, the position, the leave-pay master switch with its
 * per-type overrides, and the deduction overrides. All of them persist across
 * periods; none needs re-entering per run.
 */
export default function HrWorkerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hrAdmin = useHrAdmin();
  const [rate, setRate] = useState('');
  const [position, setPosition] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    if (!id) return null;
    const [worker, pay, leavePay, leavePayTypes, deductionTypes, deductions] = await Promise.all([
      fetchWorkerById(id),
      fetchWorkerPay(id),
      fetchWorkerLeavePay(id),
      fetchWorkerLeavePayTypes(id),
      fetchDeductionTypes(),
      fetchWorkerDeductions(id),
    ]);
    return { worker, pay, leavePay, leavePayTypes, deductionTypes, deductions };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    setRate(data.pay?.hourly_rate != null ? String(data.pay.hourly_rate) : '');
    setPosition(data.worker?.position ?? '');
  }, [data]);

  const worker = data?.worker;
  const masterOn = data?.leavePay?.paid_leave_enabled === true;

  async function mutate(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.');
    } finally {
      setBusy(false);
    }
  }

  async function saveRate() {
    const value = Number(rate.replace(/[^\d.]/g, ''));
    if (!value || value <= 0) {
      setError('Enter an hourly rate greater than zero.');
      return;
    }
    if (!worker) return;
    await mutate(() => upsertWorkerPay(worker.id, value, hrAdmin.id));
    Alert.alert('Rate saved', `${worker.full_name} is now ${peso(value)}/hr.`);
  }

  async function savePosition() {
    if (!worker) return;
    await mutate(() => updateWorkerPosition(worker.id, position.trim()));
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
        <EmptyState title="Worker not found" />
      </ScreenBody>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: worker.full_name }} />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initialsOf(worker.full_name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={type.greet}>{worker.full_name}</Text>
            <Text style={type.subgreet}>{worker.phone || 'No phone on file'}</Text>
            <View style={s.pillRow}>
              <Pill label={worker.employment_status} tone={toneForStatus(worker.employment_status)} />
              <Pill label={worker.status} tone={toneForStatus(worker.status)} />
            </View>
          </View>
        </View>

        {error ? <ErrorNote message={error} /> : null}

        {worker.employment_status !== 'active' ? (
          <Card style={s.separatedCard}>
            <Text style={s.separatedTitle}>Separated worker</Text>
            <Text style={s.separatedBody}>
              Tagged {worker.employment_status}
              {worker.employment_status_set_at
                ? ` ${relativeStamp(worker.employment_status_set_at)}`
                : ''}
              . They're excluded from future run generation automatically. Any pending pay is a
              manual call — see the Separations tab.
            </Text>
          </Card>
        ) : null}

        {/* ------------------------------- Rate ------------------------- */}
        <Section title="Pay">
          <Card style={{ padding: spacing.xl }}>
            <Field
              label="Hourly rate (₱)"
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
              placeholder="75"
              hint="One current rate, no effective-dating. Changing it affects runs generated from now on, not already-finalized periods."
            />
            <PrimaryButton label={busy ? 'Saving…' : 'Save rate'} onPress={saveRate} loading={busy} />
            {data?.pay?.updated_at ? (
              <Text style={s.meta}>Last set {relativeStamp(data.pay.updated_at)}</Text>
            ) : (
              <Text style={s.meta}>No rate on file — this worker computes to ₱0 in a run.</Text>
            )}
          </Card>
        </Section>

        {/* ----------------------------- Position ----------------------- */}
        <Section title="Position">
          <Card style={{ padding: spacing.xl }}>
            <Field
              label="Position"
              value={position}
              onChangeText={setPosition}
              placeholder="Cashier"
              autoCapitalize="words"
              hint="Used to group the payroll grid within each site."
            />
            <PrimaryButton
              label={busy ? 'Saving…' : 'Save position'}
              onPress={savePosition}
              loading={busy}
              tone="ink"
            />
          </Card>
        </Section>

        {/* ----------------------------- Leave pay ---------------------- */}
        <Section title="Leave pay">
          <Card>
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.cardTitle}>Paid leave enabled</Text>
                <Text style={type.cardSub}>
                  Off by default. While off, every leave type below resolves to unpaid regardless
                  of its own toggle — the master switch always wins.
                </Text>
              </View>
              <Switch
                value={masterOn}
                disabled={busy}
                onValueChange={(v) => mutate(() => setLeavePayMaster(worker.id, v, hrAdmin.id))}
                trackColor={{ true: colors.safety, false: colors.line }}
                thumbColor={colors.card}
              />
            </View>

            <View style={s.typeList}>
              {LEAVE_TYPES.map((t) => {
                const row = data?.leavePayTypes.find((r) => r.leave_type === t);
                const on = masterOn && row?.enabled === true;
                return (
                  <View key={t} style={[s.typeRow, !masterOn && { opacity: 0.45 }]}>
                    <Text style={s.typeName}>{t}</Text>
                    <Switch
                      value={on}
                      disabled={!masterOn || busy}
                      onValueChange={(v) =>
                        mutate(() => setLeavePayType(worker.id, t, v, hrAdmin.id, row?.id))
                      }
                      trackColor={{ true: colors.ok, false: colors.line }}
                      thumbColor={colors.card}
                    />
                  </View>
                );
              })}
            </View>

            {!masterOn ? (
              <Text style={s.meta}>
                Every leave day for this worker is currently unpaid — the default for project-based
                workers.
              </Text>
            ) : null}
          </Card>
        </Section>

        {/* ---------------------------- Deductions ---------------------- */}
        <Section title="Deduction overrides">
          <Card>
            <Text style={type.cardSub}>
              Each toggle starts from the org-wide default and persists across periods once
              changed. Switching one off here keeps every other deduction untouched.
            </Text>
            <View style={s.typeList}>
              {(data?.deductionTypes ?? []).map((dt) => {
                const override = data?.deductions.find((d) => d.deduction_type_id === dt.id);
                const on = override ? override.enabled : dt.active_by_default;
                return (
                  <View key={dt.id} style={s.typeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.typeName}>{dt.name}</Text>
                      <Text style={s.typeSub}>
                        {override
                          ? 'Overridden for this worker'
                          : `Org default (${dt.active_by_default ? 'on' : 'off'})`}
                      </Text>
                    </View>
                    <Switch
                      value={on}
                      disabled={busy}
                      onValueChange={(v) =>
                        mutate(() =>
                          setWorkerDeduction(worker.id, dt.id, v, hrAdmin.id, override?.id)
                        )
                      }
                      trackColor={{ true: colors.ok, false: colors.line }}
                      thumbColor={colors.card}
                    />
                  </View>
                );
              })}
            </View>
          </Card>
        </Section>
      </ScreenBody>
    </>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 19 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  separatedCard: { backgroundColor: colors.warnBg, borderColor: colors.warn, marginBottom: 18 },
  separatedTitle: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.warn },
  separatedBody: {
    fontSize: 11.5,
    color: colors.warn,
    lineHeight: 17,
    marginTop: 3,
    fontFamily: fonts.body,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeList: { marginTop: 12, gap: 2 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  typeName: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.ink },
  typeSub: { fontSize: 10.5, color: colors.muted, marginTop: 1, fontFamily: fonts.body },
  meta: { fontSize: 11, color: colors.muted, marginTop: 12, lineHeight: 16, fontFamily: fonts.body },
});

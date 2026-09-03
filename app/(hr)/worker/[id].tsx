/*
 * The full HR/Admin worker detail + editing screen.
 *
 * Its data layer goes through `waa-hr-worker-detail` (company-scoped edge
 * function), including the rate (`waa_worker_pay`) and leave-pay/deduction
 * overrides. One necessary difference from every other screen in this
 * batch: `fetchWorkerById` is shared with Supervisor's own worker-detail
 * screen (which has a real RLS policy for it), so this screen calls a
 * distinct `fetchWorkerByIdForHr` instead — see the comment on both
 * functions in `queries.ts`. Every other query here kept its original name
 * and signature.
 *
 * Reskinned onto the glass system — R3U-WAA-WEB-REDESIGN.md's follow-up.
 * Pushed screen (reached from Roster with a real back target), not a
 * `WebShell` sidebar destination, so this builds its own scrollable glass
 * canvas under the reskinned `(hr)` Stack header rather than the full
 * sidebar+topbar shell.
 */
import React, { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHrAdmin } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchDeductionTypes,
  fetchWorkerByIdForHr,
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
import { toneForStatus } from '../../../src/theme';
import { initialsOf, peso, relativeStamp } from '../../../src/lib/format';
import { SignedImage } from '../../../src/components/SignedImage';
import { useWebTheme } from '../../../src/web/webTheme';
import {
  GlassButton,
  GlassCard,
  GlassErrorBanner,
  GlassField,
  GlassScreen,
  WebPill,
  webToneFor,
} from '../../../src/web/webUi';
import { LinearGradient } from 'expo-linear-gradient';

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
  const { palette } = useWebTheme();
  const [rate, setRate] = useState('');
  const [position, setPosition] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    if (!id) return null;
    const [worker, pay, leavePay, leavePayTypes, deductionTypes, deductions] = await Promise.all([
      fetchWorkerByIdForHr(id),
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
      <GlassScreen>
        <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 40 }}>Loading worker…</Text>
      </GlassScreen>
    );
  }

  if (!worker) {
    return (
      <GlassScreen>
        <View style={{ padding: 20 }}>
          <GlassCard>
            <Text style={{ color: palette.text, fontWeight: '700', textAlign: 'center' }}>Worker not found</Text>
          </GlassCard>
        </View>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen>
      <Stack.Screen options={{ title: worker.full_name }} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.muted} />}
      >
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 20 }}>
          {/* A real photo once approved stands in for the initials mark —
              confirms this is the actual verified person at a glance. */}
          {worker.status === 'complete' && worker.face_scan_url ? (
            <SignedImage bucket="waa-selfies" path={worker.face_scan_url} size={58} radius={16} />
          ) : (
            <LinearGradient
              colors={[palette.accent, palette.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 19 }}>{initialsOf(worker.full_name || '?')}</Text>
            </LinearGradient>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{worker.full_name}</Text>
            <Text style={{ fontSize: 13, color: palette.muted }}>{worker.phone || 'No phone on file'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <WebPill label={worker.employment_status} tone={webToneFor(toneForStatus(worker.employment_status))} />
              <WebPill label={worker.status} tone={webToneFor(toneForStatus(worker.status))} />
            </View>
          </View>
        </View>

        {error ? <GlassErrorBanner message={error} /> : null}

        {worker.employment_status !== 'active' ? (
          <GlassCard style={{ marginBottom: 18, borderColor: palette.bad }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.bad }}>Separated worker</Text>
            <Text style={{ fontSize: 11.5, color: palette.bad, lineHeight: 17, marginTop: 3 }}>
              Tagged {worker.employment_status}
              {worker.employment_status_set_at ? ` ${relativeStamp(worker.employment_status_set_at)}` : ''}. They're excluded from
              future run generation automatically. Any pending pay is a manual call — see the Separations tab.
            </Text>
          </GlassCard>
        ) : null}

        {/* ------------------------------- Rate ------------------------- */}
        <SectionTitle>Pay</SectionTitle>
        <GlassCard style={{ marginBottom: 18 }}>
          <GlassField
            label="Hourly rate (₱)"
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
            placeholder="75"
            hint="One current rate, no effective-dating. Changing it affects runs generated from now on, not already-finalized periods."
          />
          <GlassButton label={busy ? 'Saving…' : 'Save rate'} onPress={saveRate} loading={busy} />
          {data?.pay?.updated_at ? (
            <Text style={{ fontSize: 11, color: palette.muted, marginTop: 12, lineHeight: 16 }}>Last set {relativeStamp(data.pay.updated_at)}</Text>
          ) : (
            <Text style={{ fontSize: 11, color: palette.muted, marginTop: 12, lineHeight: 16 }}>No rate on file — this worker computes to ₱0 in a run.</Text>
          )}
        </GlassCard>

        {/* ----------------------------- Position ----------------------- */}
        <SectionTitle>Position</SectionTitle>
        <GlassCard style={{ marginBottom: 18 }}>
          <GlassField
            label="Position"
            value={position}
            onChangeText={setPosition}
            placeholder="Cashier"
            autoCapitalize="words"
            hint="Used to group the payroll grid within each site."
          />
          <GlassButton label={busy ? 'Saving…' : 'Save position'} onPress={savePosition} loading={busy} />
        </GlassCard>

        {/* ----------------------------- Leave pay ---------------------- */}
        <SectionTitle>Leave pay</SectionTitle>
        <GlassCard style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>Paid leave enabled</Text>
              <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17, marginTop: 2 }}>
                Off by default. While off, every leave type below resolves to unpaid regardless of its own toggle — the master switch
                always wins.
              </Text>
            </View>
            <Switch
              value={masterOn}
              disabled={busy}
              onValueChange={(v) => mutate(() => setLeavePayMaster(worker.id, v, hrAdmin.id))}
              trackColor={{ true: palette.accent, false: palette.border }}
              thumbColor="#fff"
            />
          </View>

          <View style={{ marginTop: 12, gap: 2 }}>
            {LEAVE_TYPES.map((t) => {
              const row = data?.leavePayTypes.find((r) => r.leave_type === t);
              const on = masterOn && row?.enabled === true;
              return (
                <View
                  key={t}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 9,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                    opacity: masterOn ? 1 : 0.45,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: palette.text }}>{t}</Text>
                  <Switch
                    value={on}
                    disabled={!masterOn || busy}
                    onValueChange={(v) => mutate(() => setLeavePayType(worker.id, t, v, hrAdmin.id, row?.id))}
                    trackColor={{ true: palette.good, false: palette.border }}
                    thumbColor="#fff"
                  />
                </View>
              );
            })}
          </View>

          {!masterOn ? (
            <Text style={{ fontSize: 11, color: palette.muted, marginTop: 12, lineHeight: 16 }}>
              Every leave day for this worker is currently unpaid — the default for project-based workers.
            </Text>
          ) : null}
        </GlassCard>

        {/* ---------------------------- Deductions ---------------------- */}
        <SectionTitle>Deduction overrides</SectionTitle>
        <GlassCard style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17 }}>
            Each toggle starts from the org-wide default and persists across periods once changed. Switching one off here keeps every
            other deduction untouched.
          </Text>
          <View style={{ marginTop: 12, gap: 2 }}>
            {(data?.deductionTypes ?? []).map((dt) => {
              const override = data?.deductions.find((d) => d.deduction_type_id === dt.id);
              const on = override ? override.enabled : dt.active_by_default;
              return (
                <View
                  key={dt.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 9,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>{dt.name}</Text>
                    <Text style={{ fontSize: 10.5, color: palette.muted, marginTop: 1 }}>
                      {override ? 'Overridden for this worker' : `Org default (${dt.active_by_default ? 'on' : 'off'})`}
                    </Text>
                  </View>
                  <Switch
                    value={on}
                    disabled={busy}
                    onValueChange={(v) => mutate(() => setWorkerDeduction(worker.id, dt.id, v, hrAdmin.id, override?.id))}
                    trackColor={{ true: palette.good, false: palette.border }}
                    thumbColor="#fff"
                  />
                </View>
              );
            })}
          </View>
        </GlassCard>
      </ScrollView>
    </GlassScreen>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { palette } = useWebTheme();
  return <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>{children}</Text>;
}

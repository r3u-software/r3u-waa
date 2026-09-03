/*
 * The full cash-advance ledger (pending + approved + history). Replaced on
 * mobile by `(tabs)/index.tsx`, which does the same approve/decline and
 * proof-of-payout work through `waa-hr-mobile-cash-advances`, one decision at
 * a time and with no browsable history.
 *
 * Its data layer is fixed as of this phase — reused rather than duplicated:
 * `fetchAllCashAdvances` now calls that same `waa-hr-mobile-cash-advances`
 * function's new `list_all` action, and `hrDecideCashAdvance` /
 * `attachCashAdvanceProof` call its existing `decide` / `mark_paid_out`
 * actions — already company-scoped, already live-tested by the mobile
 * screen. See the comments on those functions in `queries.ts` for exactly
 * how the screen's two-call proof-then-paid-out sequence maps onto that
 * single `mark_paid_out` action.
 */
import React, { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { useHrAdmin } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import {
  attachCashAdvanceProof,
  fetchAllCashAdvances,
  hrDecideCashAdvance,
  markCashAdvancePaidOut,
} from '../../src/lib/queries';
import type { WaaCashAdvanceDetailed } from '../../src/lib/types';
import { captureDocument, pickImageFromLibrary } from '../../src/lib/capture';
import { uploadToPath } from '../../src/lib/storage';
import { EmptyState, Loader } from '../../src/components/ui';
import { SignedImage } from '../../src/components/SignedImage';
import { toneForStatus } from '../../src/theme';
import { peso, relativeStamp } from '../../src/lib/format';
import { WebShell } from '../../src/web/WebShell';
import { useWebTheme } from '../../src/web/webTheme';
import {
  GlassButton,
  GlassCard,
  GlassErrorBanner,
  GlassField,
  GlassOutlineButton,
  WebPageHeader,
  WebPill,
  WebSection,
  webToneFor,
} from '../../src/web/webUi';

/**
 * Cash advances, end to end: requested -> approved -> paid out -> settled.
 *
 * Approval belongs to HR/Admin only; supervisors lost it with this module.
 * "Paid out" is gated by the `waa_car_require_proof` trigger — the proof must
 * already be written to `waa_cash_advance_money.proof_url`, so the upload
 * happens first and the status flip second. "Settled" is not set here at all:
 * the `waa_require_proof_before_paid` trigger settles every advance a payroll
 * run claimed at the moment that run reaches `paid`.
 */
export default function HrCashAdvances() {
  const hrAdmin = useHrAdmin();
  const { palette } = useWebTheme();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<WaaCashAdvanceDetailed | null>(null);
  const [remarks, setRemarks] = useState('');

  const { data, loading, reload } = useAsync(() => fetchAllCashAdvances(), [hrAdmin.id]);

  const pending = (data ?? []).filter((a) => a.status === 'pending');
  const approved = (data ?? []).filter((a) => a.status === 'approved');
  const history = (data ?? []).filter(
    (a) => a.status === 'paid_out' || a.status === 'settled' || a.status === 'declined'
  );

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.');
    } finally {
      setBusyId(null);
    }
  }

  function askProof(advance: WaaCashAdvanceDetailed) {
    Alert.alert('Attach proof of payment', 'Where is the bank transfer or receipt?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => uploadProof(advance, 'camera') },
      { text: 'Choose from photos', onPress: () => uploadProof(advance, 'library') },
    ]);
  }

  /**
   * Uploads the proof, writes it to the money row, then attempts `paid_out`.
   * If the trigger still rejects the flip, its message surfaces verbatim.
   */
  async function uploadProof(advance: WaaCashAdvanceDetailed, source: 'camera' | 'library') {
    const uri = source === 'camera' ? await captureDocument() : await pickImageFromLibrary();
    if (!uri) return;
    await run(advance.id, async () => {
      const path = await uploadToPath(
        'waa-payroll-proofs',
        `cash-advance/${advance.id}`,
        uri,
        'proof'
      );
      await attachCashAdvanceProof(advance.id, path);
      await markCashAdvancePaidOut(advance.id);
    });
  }

  return (
    <WebShell active="cash-advances" title="Cash advances" subtitle="Requested → approved → paid out → settled">
      <WebPageHeader eyebrow="Workforce" title="Cash advances" sub="Every request, on every site, from filing to settlement." />
      {error ? <GlassErrorBanner message={error} /> : null}

      <WebSection title="Waiting on you">
        {loading && !data ? (
          <Loader />
        ) : pending.length === 0 ? (
          <EmptyState
            title="No requests to decide"
            body="Cash advance requests from any worker, on any site, land here."
          />
        ) : (
          pending.map((a) => (
            <GlassCard key={a.id} style={{ marginBottom: 9 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                    {a.money ? peso(a.money.amount) : 'Amount unavailable'}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>
                    {a.worker?.full_name ?? 'Worker'} · {a.reason || 'No reason given'}
                  </Text>
                  <Text style={{ fontSize: 11, color: palette.muted, marginTop: 3 }}>Filed {relativeStamp(a.created_at)}</Text>
                </View>
                <WebPill label="Requested" tone="info" />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <GlassOutlineButton
                  label="Decline"
                  onPress={() => {
                    setRemarks('');
                    setDeclining(a);
                  }}
                  style={{ flex: 1 }}
                />
                <GlassButton
                  label={busyId === a.id ? 'Working…' : 'Approve'}
                  tone="good"
                  onPress={() => run(a.id, () => hrDecideCashAdvance(a.id, 'approved', hrAdmin.id))}
                  loading={busyId === a.id}
                  style={{ flex: 1 }}
                />
              </View>
            </GlassCard>
          ))
        )}
      </WebSection>

      <WebSection title="Approved — release the money">
        {approved.length === 0 ? (
          <EmptyState
            title="Nothing to release"
            body="Approved advances waiting on a payout appear here."
          />
        ) : (
          approved.map((a) => (
            <GlassCard key={a.id} style={{ marginBottom: 9 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                    {a.money ? peso(a.money.amount) : 'Amount unavailable'}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>
                    {a.worker?.full_name ?? 'Worker'} · {a.reason || 'No reason given'}
                  </Text>
                </View>
                <WebPill label="Approved" tone="good" />
              </View>
              <Text style={{ fontSize: 11.5, color: palette.muted, lineHeight: 17, marginTop: 10 }}>
                Attaching proof of the transfer marks this paid out. The database refuses the status change without one.
              </Text>
              <GlassButton
                label={busyId === a.id ? 'Working…' : 'Attach proof & mark paid out'}
                onPress={() => askProof(a)}
                loading={busyId === a.id}
                tone="good"
                style={{ marginTop: 12 }}
              />
            </GlassCard>
          ))
        )}
      </WebSection>

      <WebSection title="History">
        {history.length === 0 ? (
          <EmptyState title="Nothing yet" />
        ) : (
          history.map((a) => (
            <GlassCard key={a.id} style={{ marginBottom: 9 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                    {a.money ? peso(a.money.amount) : 'Amount unavailable'}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>
                    {a.worker?.full_name ?? 'Worker'} · {a.reason || 'No reason given'}
                  </Text>
                  {a.status === 'declined' && a.money?.decline_remarks ? (
                    <Text style={{ fontSize: 11, color: palette.muted, marginTop: 3 }}>Declined: {a.money.decline_remarks}</Text>
                  ) : a.status === 'settled' ? (
                    <Text style={{ fontSize: 11, color: palette.muted, marginTop: 3 }}>Deducted in a payroll run.</Text>
                  ) : a.money?.paid_out_at ? (
                    <Text style={{ fontSize: 11, color: palette.muted, marginTop: 3 }}>
                      Released {relativeStamp(a.money.paid_out_at)} · awaiting deduction
                    </Text>
                  ) : null}
                </View>
                <WebPill label={a.status.replace('_', ' ')} tone={webToneFor(toneForStatus(a.status))} />
              </View>
              {a.money?.proof_url ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <SignedImage bucket="waa-payroll-proofs" path={a.money.proof_url} size={44} />
                  <Text style={{ fontSize: 12, color: palette.good, fontWeight: '700' }}>Proof of payment on file</Text>
                </View>
              ) : null}
            </GlassCard>
          ))
        )}
      </WebSection>

      {/* ------------------------- Decline remarks ---------------------- */}
      <Modal
        visible={!!declining}
        transparent
        animationType="slide"
        onRequestClose={() => setDeclining(null)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setDeclining(null)}>
          <Pressable
            style={{ backgroundColor: palette.panelSolid, borderWidth: 1, borderColor: palette.border, borderBottomWidth: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 40 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text, marginBottom: 4 }}>Decline this advance?</Text>
            <Text style={{ fontSize: 12.5, color: palette.muted, lineHeight: 18, marginBottom: 16 }}>
              Your remarks are shown to {declining?.worker?.full_name ?? 'the worker'}.
            </Text>
            <GlassField label="Remarks (optional)" value={remarks} onChangeText={setRemarks} placeholder="Why are you declining?" multiline />
            <GlassButton
              label="Decline request"
              tone="warn"
              onPress={() => {
                const target = declining;
                setDeclining(null);
                if (!target) return;
                run(target.id, () =>
                  hrDecideCashAdvance(
                    target.id,
                    'declined',
                    hrAdmin.id,
                    remarks.trim() || undefined
                  )
                );
              }}
            />
            <GlassOutlineButton
              label="Cancel"
              onPress={() => setDeclining(null)}
              style={{ marginTop: 10 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </WebShell>
  );
}

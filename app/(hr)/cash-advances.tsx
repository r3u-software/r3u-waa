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
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
import {
  ApproveRow,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Loader,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from '../../src/components/ui';
import { SignedImage } from '../../src/components/SignedImage';
import { colors, fonts, spacing, toneForStatus, type } from '../../src/theme';
import { peso, relativeStamp } from '../../src/lib/format';
import { WebShell } from '../../src/web/WebShell';
import { WebPageHeader, WebSection } from '../../src/web/webUi';

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
      {error ? <ErrorNote message={error} /> : null}

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
            <Card key={a.id}>
              <View style={s.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={type.cardTitle}>
                    {a.money ? peso(a.money.amount) : 'Amount unavailable'}
                  </Text>
                  <Text style={type.cardSub}>
                    {a.worker?.full_name ?? 'Worker'} · {a.reason || 'No reason given'}
                  </Text>
                  <Text style={s.stamp}>Filed {relativeStamp(a.created_at)}</Text>
                </View>
                <Pill label="Requested" tone="pending" />
              </View>
              <ApproveRow
                busy={busyId === a.id}
                onApprove={() => run(a.id, () => hrDecideCashAdvance(a.id, 'approved', hrAdmin.id))}
                onDecline={() => {
                  setRemarks('');
                  setDeclining(a);
                }}
              />
            </Card>
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
            <Card key={a.id}>
              <View style={s.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={type.cardTitle}>
                    {a.money ? peso(a.money.amount) : 'Amount unavailable'}
                  </Text>
                  <Text style={type.cardSub}>
                    {a.worker?.full_name ?? 'Worker'} · {a.reason || 'No reason given'}
                  </Text>
                </View>
                <Pill label="Approved" tone="ok" />
              </View>
              <Text style={s.note}>
                Attaching proof of the transfer marks this paid out. The database refuses the status
                change without one.
              </Text>
              <PrimaryButton
                label={busyId === a.id ? 'Working…' : 'Attach proof & mark paid out'}
                onPress={() => askProof(a)}
                loading={busyId === a.id}
                style={{ marginTop: 12 }}
              />
            </Card>
          ))
        )}
      </WebSection>

      <WebSection title="History">
        {history.length === 0 ? (
          <EmptyState title="Nothing yet" />
        ) : (
          history.map((a) => (
            <Card key={a.id}>
              <View style={s.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={type.cardTitle}>
                    {a.money ? peso(a.money.amount) : 'Amount unavailable'}
                  </Text>
                  <Text style={type.cardSub}>
                    {a.worker?.full_name ?? 'Worker'} · {a.reason || 'No reason given'}
                  </Text>
                  {a.status === 'declined' && a.money?.decline_remarks ? (
                    <Text style={s.stamp}>Declined: {a.money.decline_remarks}</Text>
                  ) : a.status === 'settled' ? (
                    <Text style={s.stamp}>Deducted in a payroll run.</Text>
                  ) : a.money?.paid_out_at ? (
                    <Text style={s.stamp}>
                      Released {relativeStamp(a.money.paid_out_at)} · awaiting deduction
                    </Text>
                  ) : null}
                </View>
                <Pill label={a.status.replace('_', ' ')} tone={toneForStatus(a.status)} />
              </View>
              {a.money?.proof_url ? (
                <View style={s.proofRow}>
                  <SignedImage bucket="waa-payroll-proofs" path={a.money.proof_url} size={44} />
                  <Text style={s.proofText}>Proof of payment on file</Text>
                </View>
              ) : null}
            </Card>
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
        <Pressable style={s.backdrop} onPress={() => setDeclining(null)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Decline this advance?</Text>
            <Text style={s.sheetSub}>
              Your remarks are shown to {declining?.worker?.full_name ?? 'the worker'}.
            </Text>
            <Field
              label="Remarks (optional)"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Why are you declining?"
              multiline
            />
            <PrimaryButton
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
            <SecondaryButton
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

const s = StyleSheet.create({
  rowTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stamp: { fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
  note: { fontSize: 11.5, color: colors.muted, lineHeight: 17, marginTop: 10, fontFamily: fonts.body },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  proofText: { fontSize: 12, color: colors.ok, fontFamily: fonts.bodySemi },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,27,24,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  sheetTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 12.5,
    color: colors.muted,
    marginBottom: spacing.lg,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
});

import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useHrAdmin } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  hrDecideCashAdvanceMobile,
  hrListCashAdvancesAwaitingPayout,
  hrListPendingCashAdvances,
  hrMarkCashAdvancePaidOut,
  type HrPendingCashAdvance,
} from '../../../src/lib/hrMobile';
import { captureDocument, pickImageFromLibrary } from '../../../src/lib/capture';
import { uploadToPath } from '../../../src/lib/storage';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
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
  Section,
} from '../../../src/components/ui';
import { colors, fonts, radius, spacing, type } from '../../../src/theme';
import { peso, relativeStamp } from '../../../src/lib/format';

/**
 * Emergency-mobile action 1 of 3: cash advance approval and payout.
 *
 * Every read and write here goes through `waa-hr-mobile-cash-advances` —
 * HR/Admin has no direct grant on `waa_cash_advance_money` any more, so there
 * is nothing broader this screen could accidentally pull. Each card shows only
 * what the decision needs: one worker, one amount, one reason. No grid, no
 * other workers' figures, no browsable history (the ledger stays on the web
 * dashboard).
 *
 * Payout is proof-first: the photo is uploaded to `waa-payroll-proofs` before
 * `mark_paid_out` is attempted, because the `waa_car_require_proof` DB trigger
 * rejects the status flip outright while `proof_url` is null.
 */
type PaneKey = 'decide' | 'payout';

export default function HrCashAdvances() {
  const hrAdmin = useHrAdmin();
  const [view, setView] = useState<PaneKey>('decide');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<HrPendingCashAdvance | null>(null);
  const [remarks, setRemarks] = useState('');

  const { data, loading, reload } = useAsync(async () => {
    const [pending, awaitingPayout] = await Promise.all([
      hrListPendingCashAdvances(),
      hrListCashAdvancesAwaitingPayout(),
    ]);
    return { pending, awaitingPayout };
  }, [hrAdmin.id]);

  const pending = data?.pending ?? [];
  const awaitingPayout = data?.awaitingPayout ?? [];

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

  function askProof(id: string) {
    Alert.alert('Attach proof of payment', 'Where is the bank transfer or receipt?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => uploadProof(id, 'camera') },
      { text: 'Choose from photos', onPress: () => uploadProof(id, 'library') },
    ]);
  }

  async function uploadProof(id: string, source: 'camera' | 'library') {
    const uri = source === 'camera' ? await captureDocument() : await pickImageFromLibrary();
    if (!uri) return;
    await run(id, async () => {
      const path = await uploadToPath('waa-payroll-proofs', `cash-advance/${id}`, uri, 'proof');
      await hrMarkCashAdvancePaidOut(id, path);
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Cash advances" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.greet}>Cash advances</Text>
        <Text style={[type.subgreet, { marginBottom: 18 }]}>
          One request at a time — approve, decline, or release the money.
        </Text>

        <View style={s.switch}>
          {(
            [
              ['decide', `To decide${pending.length ? ` (${pending.length})` : ''}`],
              ['payout', `To pay out${awaitingPayout.length ? ` (${awaitingPayout.length})` : ''}`],
            ] as [PaneKey, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => {
                setView(key);
                setError(null);
              }}
              style={[s.switchBtn, view === key && s.switchBtnActive]}
            >
              <Text style={[s.switchText, view === key && s.switchTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <ErrorNote message={error} /> : null}

        {loading && !data ? (
          <Loader label="Loading requests" />
        ) : view === 'decide' ? (
          <Section title="Waiting on you">
            {pending.length === 0 ? (
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
                        {a.amount == null ? 'Amount unavailable' : peso(a.amount)}
                      </Text>
                      <Text style={type.cardSub}>{a.worker_name}</Text>
                      <Text style={s.reason}>{a.reason || 'No reason given'}</Text>
                      <Text style={s.stamp}>Filed {relativeStamp(a.created_at)}</Text>
                    </View>
                    <Pill label="Requested" tone="pending" />
                  </View>
                  <ApproveRow
                    busy={busyId === a.id}
                    onApprove={() => run(a.id, () => hrDecideCashAdvanceMobile(a.id, 'approved'))}
                    onDecline={() => {
                      setRemarks('');
                      setDeclining(a);
                    }}
                  />
                </Card>
              ))
            )}
          </Section>
        ) : (
          <Section title="Approved — release the money">
            {awaitingPayout.length === 0 ? (
              <EmptyState
                title="Nothing to release"
                body="Approved advances waiting on a payout appear here."
              />
            ) : (
              awaitingPayout.map((a) => (
                <Card key={a.id}>
                  <View style={s.rowTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.cardTitle}>
                        {a.amount == null ? 'Amount unavailable' : peso(a.amount)}
                      </Text>
                      <Text style={type.cardSub}>{a.worker_name}</Text>
                    </View>
                    <Pill label="Approved" tone="ok" />
                  </View>
                  <Text style={s.note}>
                    Photographing the transfer receipt marks this paid out. The database refuses the
                    status change without one.
                  </Text>
                  <PrimaryButton
                    label={busyId === a.id ? 'Working…' : 'Attach proof & mark paid out'}
                    onPress={() => askProof(a.id)}
                    loading={busyId === a.id}
                    style={{ marginTop: 12 }}
                  />
                </Card>
              ))
            )}
          </Section>
        )}
      </ScreenBody>

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
              Your remarks are shown to {declining?.worker_name ?? 'the worker'}.
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
                  hrDecideCashAdvanceMobile(target.id, 'declined', remarks.trim() || undefined)
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
    </View>
  );
}

const s = StyleSheet.create({
  switch: {
    flexDirection: 'row',
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    padding: 5,
    gap: 5,
    marginBottom: spacing.xl,
  },
  switchBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center' },
  switchBtnActive: { backgroundColor: colors.safety },
  switchText: { fontSize: 12, fontFamily: fonts.bodySemi, color: '#C8C4B8' },
  switchTextActive: { color: colors.ink, fontFamily: fonts.bodyBold },
  rowTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reason: { fontSize: 12.5, color: colors.ink, marginTop: 6, lineHeight: 18, fontFamily: fonts.body },
  stamp: { fontSize: 11, color: colors.muted, marginTop: 4, fontFamily: fonts.body },
  note: {
    fontSize: 11.5,
    color: colors.muted,
    lineHeight: 17,
    marginTop: 10,
    fontFamily: fonts.body,
  },
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

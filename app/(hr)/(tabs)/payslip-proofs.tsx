import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useHrAdmin } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  hrAttachPayslipProof,
  hrListPayslipsMissingProof,
} from '../../../src/lib/hrMobile';
import { captureDocument, pickImageFromLibrary } from '../../../src/lib/capture';
import { uploadToPath } from '../../../src/lib/storage';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import {
  Card,
  EmptyState,
  ErrorNote,
  Loader,
  Pill,
  PrimaryButton,
  Section,
} from '../../../src/components/ui';
import { colors, fonts, type } from '../../../src/theme';
import { periodLabel, peso } from '../../../src/lib/format';

/**
 * Emergency-mobile action 3 of 3: proof-of-payment capture.
 *
 * Only payslips on already-Finalized runs that are still missing proof appear
 * here — getting a run to Finalized (Draft → Reviewed → Finalized) stays
 * web-only per the addendum, and `waa-hr-mobile-payslip-proofs` will not touch
 * a run in any other state. Each card is one worker and one net figure: the
 * single confirm-and-attach action the addendum describes, not a payroll grid.
 *
 * There is deliberately no "mark run paid" button anywhere on mobile. The edge
 * function completes the run itself the moment the last payslip on it gets
 * proof, and tells us so via `run_marked_paid` — which is what the confirmation
 * alert below reports.
 *
 * Uploads use the addendum's exact convention,
 * `payslip/{worker_id}/{payroll_run_id}/{filename}` — `list_pending` returns
 * `worker_id` for this — so the `waa_payroll_proofs_select_own_payslip`
 * storage policy correctly lets a worker fetch their own proof image later.
 */
export default function HrPayslipProofs() {
  const hrAdmin = useHrAdmin();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(() => hrListPayslipsMissingProof(), [hrAdmin.id]);
  const items = data ?? [];

  function askProof(payslipId: string) {
    Alert.alert('Attach proof of payment', 'Where is the bank transfer or receipt?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => uploadProof(payslipId, 'camera') },
      { text: 'Choose from photos', onPress: () => uploadProof(payslipId, 'library') },
    ]);
  }

  async function uploadProof(payslipId: string, source: 'camera' | 'library') {
    const item = items.find((i) => i.payslip_id === payslipId);
    if (!item) return;
    const uri = source === 'camera' ? await captureDocument() : await pickImageFromLibrary();
    if (!uri) return;

    setBusyId(payslipId);
    setError(null);
    try {
      const path = await uploadToPath(
        'waa-payroll-proofs',
        `payslip/${item.worker_id}/${item.payroll_run_id}`,
        uri,
        'proof'
      );
      const { run_marked_paid } = await hrAttachPayslipProof(payslipId, path);
      await reload();
      if (run_marked_paid) {
        Alert.alert(
          'Run marked Paid',
          `That was the last payslip missing proof for ${periodLabel(
            item.period_start,
            item.period_end
          )}. The whole run is now Paid, and any cash advances it covered have been settled.`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach that proof.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Proof of payment" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.greet}>Proof of payment</Text>
        <Text style={[type.subgreet, { marginBottom: 18 }]}>
          Finalized payslips still waiting on a receipt
        </Text>

        {error ? <ErrorNote message={error} /> : null}

        {loading && !data ? (
          <Loader label="Loading payslips" />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing waiting on proof"
            body="Once a run is finalized on the web dashboard, each payslip needing a receipt shows up here."
          />
        ) : (
          <Section title={`${items.length} to confirm`}>
            {items.map((p) => (
              <Card key={p.payslip_id}>
                <View style={s.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.cardTitle}>{p.worker_name}</Text>
                    <Text style={type.cardSub}>
                      {periodLabel(p.period_start, p.period_end)}
                    </Text>
                    <Text style={s.amount}>{peso(p.net_pay)}</Text>
                  </View>
                  <Pill label="Needs proof" tone="pending" />
                </View>
                <PrimaryButton
                  label={busyId === p.payslip_id ? 'Uploading…' : 'Attach proof of payment'}
                  onPress={() => askProof(p.payslip_id)}
                  loading={busyId === p.payslip_id}
                  style={{ marginTop: 12 }}
                />
              </Card>
            ))}
          </Section>
        )}
      </ScreenBody>
    </View>
  );
}

const s = StyleSheet.create({
  rowTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  amount: {
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 6,
  },
});

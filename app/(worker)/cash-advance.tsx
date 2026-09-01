import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useWorker } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { fetchWorkerCashAdvances, submitCashAdvance } from '../../src/lib/queries';
import { ScreenBody } from '../../src/components/Screen';
import {
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Loader,
  Pill,
  PrimaryButton,
  Section,
} from '../../src/components/ui';
import { SignedImage } from '../../src/components/SignedImage';
import { colors, fonts, spacing, toneForStatus, type } from '../../src/theme';
import { peso, relativeStamp } from '../../src/lib/format';

/** Human wording for the advance lifecycle: requested -> approved -> paid out -> settled. */
const STATUS_LABEL: Record<string, string> = {
  pending: 'Requested',
  approved: 'Approved',
  declined: 'Declined',
  paid_out: 'Paid out',
  settled: 'Settled',
};

const STATUS_NOTE: Record<string, string> = {
  pending: 'Waiting on the office to review this.',
  approved: 'Approved — the office will release the money and attach proof of payment.',
  paid_out: 'Released to you. It will be deducted from an upcoming payslip.',
  settled: 'Already deducted from your pay.',
};

/**
 * Cash advance ("vale") request + history.
 *
 * The amount now lives on `waa_cash_advance_money`, joined in here — the
 * worker can read their own money row, which is what lets them see their own
 * figure back. Submission goes through the `waa_submit_cash_advance` RPC
 * because the request and its amount are two inserts across two tables.
 *
 * Approval belongs to HR/Admin now, not the supervisor.
 */
export default function CashAdvanceScreen() {
  const worker = useWorker();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(() => fetchWorkerCashAdvances(worker.id), [worker.id]);

  async function submit() {
    const value = Number(amount.replace(/[^\d.]/g, ''));
    if (!value || value <= 0) {
      setError('Enter how much you need.');
      return;
    }
    if (!reason.trim()) {
      setError('Add a short reason — the office sees this when deciding.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await submitCashAdvance(value, reason.trim());
      setAmount('');
      setReason('');
      await reload();
      Alert.alert('Request sent', 'HR/Admin has been notified.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBody refreshing={loading} onRefresh={reload}>
      <Section title="Request an advance">
        {error ? <ErrorNote message={error} /> : null}
        <Card style={{ padding: spacing.xl }}>
          <Field
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="500"
            keyboardType="numeric"
          />
          <Field
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="What is it for?"
            multiline
          />
          <PrimaryButton
            label={busy ? 'Sending…' : 'Send request'}
            onPress={submit}
            loading={busy}
          />
        </Card>
      </Section>

      <Section title="Your requests">
        {loading && !data ? (
          <Loader />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title="No requests yet" body="Advances you ask for will be listed here." />
        ) : (
          data!.map((a) => (
            <Card key={a.id}>
              <View style={s.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={type.cardTitle}>
                    {a.money ? peso(a.money.amount) : 'Amount unavailable'}
                  </Text>
                  <Text style={type.cardSub}>
                    {a.reason || 'No reason given'} · {relativeStamp(a.created_at)}
                  </Text>
                </View>
                <Pill label={STATUS_LABEL[a.status] ?? a.status} tone={toneForStatus(a.status)} />
              </View>

              {STATUS_NOTE[a.status] ? (
                <Text style={s.statusNote}>{STATUS_NOTE[a.status]}</Text>
              ) : null}

              {a.status === 'declined' && a.money?.decline_remarks ? (
                <View style={s.remarks}>
                  <Text style={s.remarksText}>Office remarks: {a.money.decline_remarks}</Text>
                </View>
              ) : null}

              {a.money?.receipt_url ? (
                <View style={s.receiptRow}>
                  <SignedImage bucket="waa-receipts" path={a.money.receipt_url} size={44} />
                  <Text style={s.receiptText}>Receipt on file</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </Section>
    </ScreenBody>
  );
}

const s = StyleSheet.create({
  rowTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  statusNote: { fontSize: 11.5, color: colors.muted, lineHeight: 17, marginTop: 8, fontFamily: fonts.body },
  remarks: {
    backgroundColor: colors.warnBg,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  remarksText: { fontSize: 12, color: colors.warn, lineHeight: 17, fontFamily: fonts.body },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  receiptText: { fontSize: 12, color: colors.ok, fontFamily: fonts.bodySemi },
});

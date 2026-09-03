import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorker } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { fetchWorkerCashAdvances, submitCashAdvance } from '../../src/lib/queries';
import { EmptyState } from '../../src/components/ui';
import { SignedImage } from '../../src/components/SignedImage';
import { toneForStatus } from '../../src/theme';
import { peso, relativeStamp } from '../../src/lib/format';
import { useWebTheme } from '../../src/web/webTheme';
import { GlassButton, GlassCard, GlassErrorBanner, GlassField, GlassScreen, WebPill, webToneFor } from '../../src/web/webUi';

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
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();
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
    <GlassScreen>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.muted} />}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>Request an advance</Text>
        {error ? <GlassErrorBanner message={error} /> : null}
        <GlassCard style={{ marginBottom: 20 }}>
          <GlassField label="Amount" value={amount} onChangeText={setAmount} placeholder="500" keyboardType="numeric" />
          <GlassField label="Reason" value={reason} onChangeText={setReason} placeholder="What is it for?" multiline />
          <GlassButton label={busy ? 'Sending…' : 'Send request'} onPress={submit} loading={busy} />
        </GlassCard>

        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>Your requests</Text>
        {(data?.length ?? 0) === 0 ? (
          <EmptyState title="No requests yet" body="Advances you ask for will be listed here." />
        ) : (
          data!.map((a) => (
            <GlassCard key={a.id} style={{ marginBottom: 9 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                    {a.money ? peso(a.money.amount) : 'Amount unavailable'}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17, marginTop: 2 }}>
                    {a.reason || 'No reason given'} · {relativeStamp(a.created_at)}
                  </Text>
                </View>
                <WebPill label={STATUS_LABEL[a.status] ?? a.status} tone={webToneFor(toneForStatus(a.status))} />
              </View>

              {STATUS_NOTE[a.status] ? (
                <Text style={{ fontSize: 11.5, color: palette.muted, lineHeight: 17, marginTop: 8 }}>{STATUS_NOTE[a.status]}</Text>
              ) : null}

              {a.status === 'declined' && a.money?.decline_remarks ? (
                <View style={{ backgroundColor: palette.badBg, borderRadius: 10, padding: 10, marginTop: 10 }}>
                  <Text style={{ fontSize: 12, color: palette.bad, lineHeight: 17 }}>Office remarks: {a.money.decline_remarks}</Text>
                </View>
              ) : null}

              {a.money?.receipt_url ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <SignedImage bucket="waa-receipts" path={a.money.receipt_url} size={44} />
                  <Text style={{ fontSize: 12, color: palette.good, fontWeight: '700' }}>Receipt on file</Text>
                </View>
              ) : null}
            </GlassCard>
          ))
        )}
      </ScrollView>
    </GlassScreen>
  );
}

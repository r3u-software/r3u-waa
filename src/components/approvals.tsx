import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SignedImage } from './SignedImage';
import { ApproveRow, Card, Field, Pill, PrimaryButton, SecondaryButton } from './ui';
import { CalendarIcon, CashIcon } from './icons';
import { colors, fonts, radius, spacing, toneForStatus, type } from '../theme';
import { coords, dateRange, relativeStamp } from '../lib/format';
import type { WaaCashAdvanceDetailed, WaaLeaveRequestDetailed, WaaTimeEntryDetailed } from '../lib/types';

/**
 * A pending time punch awaiting supervisor judgement: selfie thumbnail (signed
 * URL from the private bucket), timestamp, and raw GPS coordinates.
 *
 * Coordinates are shown as text for the supervisor to eyeball — there is no
 * map and, by design, no geofence check that could block the punch.
 */
export function PunchApprovalCard({
  entry,
  busy,
  onDecide,
}: {
  entry: WaaTimeEntryDetailed;
  busy: boolean;
  onDecide: (decision: 'approved' | 'declined') => void;
}) {
  return (
    <Card>
      <View style={s.row}>
        <SignedImage bucket="waa-selfies" path={entry.selfie_url} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.cardTitle}>{entry.worker?.full_name ?? 'Worker'}</Text>
          <Text style={type.cardSub}>
            Time {entry.type} · {entry.project?.name ?? 'Site'} ·{' '}
            {relativeStamp(entry.entry_timestamp)}
          </Text>
          <Text style={s.gps}>{coords(entry.gps_lat, entry.gps_lng)}</Text>
        </View>
        <Pill label="Pending" tone="pending" />
      </View>
      <ApproveRow
        busy={busy}
        onApprove={() => onDecide('approved')}
        onDecline={() => onDecide('declined')}
      />
    </Card>
  );
}

/**
 * Read-only notice that a worker has an outstanding cash advance request.
 *
 * The supervisor no longer approves these and has no grant on
 * `waa_cash_advance_money`, so there is deliberately no amount and no action
 * here — not a hidden column, an absent one. Approval lives on the HR/Admin
 * Payroll tab.
 */
export function CashAdvanceNoticeCard({ request }: { request: WaaCashAdvanceDetailed }) {
  return (
    <Card>
      <View style={s.row}>
        <View style={s.icon}>
          <CashIcon size={17} color={colors.safetyDeep} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.cardTitle}>Cash advance requested</Text>
          <Text style={type.cardSub}>
            {request.worker?.full_name ?? 'Worker'} ·{' '}
            {request.reason ? `"${request.reason}"` : 'No reason given'}
          </Text>
          <Text style={s.stamp}>Filed {relativeStamp(request.created_at)}</Text>
        </View>
        <Pill label={request.status} tone={toneForStatus(request.status)} />
      </View>
      <Text style={s.handoffNote}>HR/Admin decides cash advances.</Text>
    </Card>
  );
}

/**
 * Leave request card. Declining opens a remarks sheet, since
 * `decline_remarks` is what the worker sees as the explanation.
 */
export function RequestApprovalCard({
  request,
  busy,
  onDecide,
}: {
  request: WaaLeaveRequestDetailed;
  busy: boolean;
  onDecide: (decision: 'approved' | 'declined', remarks?: string) => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [remarks, setRemarks] = useState('');

  const title = `${request.leave_type} leave · ${dateRange(request.date_from, request.date_to)}`;

  return (
    <>
      <Card>
        <View style={s.row}>
          <View style={s.icon}>
            <CalendarIcon size={17} color={colors.safetyDeep} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.cardTitle}>{title}</Text>
            <Text style={type.cardSub}>
              {request.worker?.full_name ?? 'Worker'} ·{' '}
              {request.reason ? `"${request.reason}"` : 'No reason given'}
            </Text>
            <Text style={s.stamp}>Filed {relativeStamp(request.created_at)}</Text>
          </View>
          <Pill label="Review" tone="pending" />
        </View>
        <ApproveRow
          busy={busy}
          onApprove={() => onDecide('approved')}
          onDecline={() => setDeclining(true)}
        />
      </Card>

      <Modal visible={declining} transparent animationType="slide" onRequestClose={() => setDeclining(false)}>
        <Pressable style={s.backdrop} onPress={() => setDeclining(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Decline this request?</Text>
            <Text style={s.sheetSub}>
              Your remarks are shown to {request.worker?.full_name ?? 'the worker'}.
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
                setDeclining(false);
                onDecide('declined', remarks.trim() || undefined);
                setRemarks('');
              }}
            />
            <SecondaryButton
              label="Cancel"
              onPress={() => setDeclining(false)}
              style={{ marginTop: 10 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.pendingBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gps: { fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
  stamp: { fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
  handoffNote: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 10,
    fontFamily: fonts.bodySemi,
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

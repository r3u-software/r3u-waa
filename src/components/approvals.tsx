import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SignedImage } from './SignedImage';
import { CalendarIcon, CashIcon } from './icons';
import { useWebTheme } from '../web/webTheme';
import { GlassButton, GlassCard, GlassField, GlassOutlineButton, WebPill, webToneFor } from '../web/webUi';
import { toneForStatus } from '../theme';
import { coords, dateRange, relativeStamp } from '../lib/format';
import type { WaaCashAdvanceDetailed, WaaLeaveRequestDetailed, WaaTimeEntryDetailed } from '../lib/types';

/**
 * Supervisor's approval cards — Supervisor's own Home and Approvals tabs are
 * the last two native screens still on the paper theme (R3U-WAA-WEB-REDESIGN.md's
 * native follow-up, this pass). Reskinned onto the same glass primitives as
 * Worker's screens; the approve/decline/decline-remarks *logic* here is
 * byte-for-byte unchanged, view layer only.
 */

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
  const { palette } = useWebTheme();
  return (
    <GlassCard style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <SignedImage bucket="waa-selfies" path={entry.selfie_url} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
            {entry.worker?.full_name ?? 'Worker'}
          </Text>
          <Text style={{ fontSize: 12, color: palette.muted }}>
            Time {entry.type} · {entry.project?.name ?? 'Site'} · {relativeStamp(entry.entry_timestamp)}
          </Text>
          <Text style={{ fontSize: 11, color: palette.muted, marginTop: 1 }}>
            {coords(entry.gps_lat, entry.gps_lng)}
          </Text>
        </View>
        <WebPill label="Pending" tone="info" />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <GlassOutlineButton label="Decline" onPress={() => onDecide('declined')} disabled={busy} style={{ flex: 1 }} />
        <GlassButton
          label={busy ? 'Working…' : 'Approve'}
          tone="good"
          onPress={() => onDecide('approved')}
          loading={busy}
          style={{ flex: 1 }}
        />
      </View>
    </GlassCard>
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
  const { palette } = useWebTheme();
  return (
    <GlassCard style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: palette.hover, alignItems: 'center', justifyContent: 'center' }}>
          <CashIcon size={17} color={palette.accent2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>Cash advance requested</Text>
          <Text style={{ fontSize: 12, color: palette.muted }}>
            {request.worker?.full_name ?? 'Worker'} · {request.reason ? `"${request.reason}"` : 'No reason given'}
          </Text>
          <Text style={{ fontSize: 11, color: palette.muted, marginTop: 1 }}>Filed {relativeStamp(request.created_at)}</Text>
        </View>
        <WebPill label={request.status} tone={webToneFor(toneForStatus(request.status))} />
      </View>
      <Text style={{ fontSize: 11, color: palette.muted, fontWeight: '600', marginTop: 10 }}>
        HR/Admin decides cash advances.
      </Text>
    </GlassCard>
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
  const { palette } = useWebTheme();
  const [declining, setDeclining] = useState(false);
  const [remarks, setRemarks] = useState('');

  const title = `${request.leave_type} leave · ${dateRange(request.date_from, request.date_to)}`;

  return (
    <>
      <GlassCard style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: palette.hover, alignItems: 'center', justifyContent: 'center' }}>
            <CalendarIcon size={17} color={palette.accent2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>{title}</Text>
            <Text style={{ fontSize: 12, color: palette.muted }}>
              {request.worker?.full_name ?? 'Worker'} · {request.reason ? `"${request.reason}"` : 'No reason given'}
            </Text>
            <Text style={{ fontSize: 11, color: palette.muted, marginTop: 1 }}>Filed {relativeStamp(request.created_at)}</Text>
          </View>
          <WebPill label="Review" tone="info" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <GlassOutlineButton label="Decline" onPress={() => setDeclining(true)} disabled={busy} style={{ flex: 1 }} />
          <GlassButton
            label={busy ? 'Working…' : 'Approve'}
            tone="good"
            onPress={() => onDecide('approved')}
            loading={busy}
            style={{ flex: 1 }}
          />
        </View>
      </GlassCard>

      <Modal visible={declining} transparent animationType="slide" onRequestClose={() => setDeclining(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          onPress={() => setDeclining(false)}
        >
          <Pressable
            style={{
              backgroundColor: palette.panelSolid,
              borderWidth: 1,
              borderColor: palette.border,
              borderBottomWidth: 0,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 22,
              paddingBottom: 40,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text, marginBottom: 4 }}>
              Decline this request?
            </Text>
            <Text style={{ fontSize: 12.5, color: palette.muted, lineHeight: 18, marginBottom: 16 }}>
              Your remarks are shown to {request.worker?.full_name ?? 'the worker'}.
            </Text>
            <GlassField
              label="Remarks (optional)"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Why are you declining?"
              multiline
            />
            <GlassButton
              label="Decline request"
              tone="warn"
              onPress={() => {
                setDeclining(false);
                onDecide('declined', remarks.trim() || undefined);
                setRemarks('');
              }}
            />
            <GlassOutlineButton label="Cancel" onPress={() => setDeclining(false)} style={{ marginTop: 10 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

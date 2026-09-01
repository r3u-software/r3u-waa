import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useHrAdmin } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  hrDecideSeparation,
  hrListSeparationCases,
  type HrSeparationCase,
} from '../../../src/lib/hrMobile';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
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
import { colors, fonts, radius, toneForStatus, type } from '../../../src/theme';
import { initialsOf, relativeStamp } from '../../../src/lib/format';

/**
 * Emergency-mobile action 2 of 3: separation case decisions.
 *
 * Read through `waa-hr-mobile-separations`, which returns exactly the context
 * the call needs — who tagged the worker and when, how much is still pending
 * (as counts, not other workers' figures), and every note recorded so far.
 *
 * Submitting a note records a decision and NOTHING ELSE. It does not release,
 * forfeit or recompute any pay: the addendum is explicit that what happens to a
 * separated worker's pending pay stays a manual human judgment call rather than
 * an automated consequence of this write. Do not "helpfully" wire pay actions
 * onto this screen later.
 */
export default function HrSeparations() {
  const hrAdmin = useHrAdmin();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(() => hrListSeparationCases(), [hrAdmin.id]);
  const cases = data ?? [];

  async function submitNote(c: HrSeparationCase) {
    const note = (notes[c.worker_id] ?? '').trim();
    if (!note) {
      setError('Write what you decided before submitting.');
      return;
    }
    setBusyId(c.worker_id);
    setError(null);
    try {
      await hrDecideSeparation(c.worker_id, note);
      setNotes((prev) => ({ ...prev, [c.worker_id]: '' }));
      // Refresh so the new entry shows up in `prior_notes`.
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that note.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Separations" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.greet}>Separation cases</Text>
        <Text style={[type.subgreet, { marginBottom: 18 }]}>
          Tagged by a supervisor · the pay outcome is your call
        </Text>

        {error ? <ErrorNote message={error} /> : null}

        {loading && !data ? (
          <Loader label="Gathering cases" />
        ) : cases.length === 0 ? (
          <EmptyState
            title="No separation cases"
            body="Workers tagged Terminated, AWOL or Resigned by their supervisor appear here with the context you need to decide."
          />
        ) : (
          <Section title={`${cases.length} case${cases.length === 1 ? '' : 's'}`}>
            {cases.map((c) => (
              <Card key={c.worker_id}>
                <View style={s.head}>
                  <View style={s.avatar}>
                    <Text style={s.initials}>{initialsOf(c.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.cardTitle}>{c.full_name}</Text>
                    <Text style={type.cardSub}>
                      Tagged by {c.tagged_by_supervisor ?? 'an unrecorded supervisor'}
                    </Text>
                    <Text style={s.stamp}>
                      {c.tagged_at ? relativeStamp(c.tagged_at) : 'At an unrecorded time'}
                    </Text>
                  </View>
                  <Pill label={c.employment_status} tone={toneForStatus(c.employment_status)} />
                </View>

                <View style={s.rule} />

                <View style={s.factRow}>
                  <Fact
                    value={c.pending_cash_advances}
                    label={`cash advance${c.pending_cash_advances === 1 ? '' : 's'} still open`}
                  />
                  <Fact
                    value={c.unfinalized_payslips}
                    label={`payslip${c.unfinalized_payslips === 1 ? '' : 's'} not yet paid`}
                  />
                </View>

                {c.pending_cash_advances === 0 && c.unfinalized_payslips === 0 ? (
                  <Text style={s.clean}>Nothing outstanding. Note the outcome for the record.</Text>
                ) : (
                  <Text style={s.judgement}>
                    Nothing here forfeits or releases any of this automatically — write down what
                    you decided and the office acts on it.
                  </Text>
                )}

                {c.prior_notes.length > 0 ? (
                  <View style={s.priorBlock}>
                    <Text style={type.label}>Prior decisions</Text>
                    {c.prior_notes.map((n) => (
                      <View key={`${n.decided_at}-${n.note}`} style={s.priorNote}>
                        <Text style={s.priorText}>{n.note}</Text>
                        <Text style={s.stamp}>{relativeStamp(n.decided_at)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={{ marginTop: 14 }}>
                  <Field
                    label="Your decision"
                    value={notes[c.worker_id] ?? ''}
                    onChangeText={(t) => setNotes((prev) => ({ ...prev, [c.worker_id]: t }))}
                    placeholder="e.g. Release final pay in the next run; deduct the outstanding advance."
                    multiline
                  />
                  <PrimaryButton
                    label={busyId === c.worker_id ? 'Recording…' : 'Record decision'}
                    onPress={() => submitNote(c)}
                    loading={busyId === c.worker_id}
                  />
                </View>
              </Card>
            ))}
          </Section>
        )}
      </ScreenBody>
    </View>
  );
}

function Fact({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.fact}>
      <Text style={[s.factValue, value > 0 && { color: colors.safetyDeep }]}>{value}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.steel },
  stamp: { fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  factRow: { flexDirection: 'row', gap: 10 },
  fact: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 11,
  },
  factValue: { fontFamily: fonts.serif, fontSize: 20, fontWeight: '700', color: colors.ok },
  factLabel: { fontSize: 10.5, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
  clean: { fontSize: 11.5, color: colors.ok, lineHeight: 17, marginTop: 10, fontFamily: fonts.bodySemi },
  judgement: {
    fontSize: 11.5,
    color: colors.safetyDeep,
    lineHeight: 17,
    marginTop: 10,
    fontFamily: fonts.body,
  },
  priorBlock: { marginTop: 14, gap: 6 },
  priorNote: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 10,
  },
  priorText: { fontSize: 12.5, color: colors.ink, lineHeight: 18, fontFamily: fonts.body },
});

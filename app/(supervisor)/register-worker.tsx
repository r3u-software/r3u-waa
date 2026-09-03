import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAsync } from '../../src/lib/useAsync';
import { fetchProjects, registerWorker } from '../../src/lib/queries';
import type { RegisterWorkerResult } from '../../src/lib/types';
import { ScreenBody } from '../../src/components/Screen';
import {
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Loader,
  PrimaryButton,
  SecondaryButton,
  Section,
} from '../../src/components/ui';
import { LockIcon } from '../../src/components/icons';
import { colors, fonts, radius, spacing, type } from '../../src/theme';

/**
 * Registers a worker through the `waa-register-worker` edge function — the
 * only supported path, since creating the Auth account needs the service-role
 * key and that never touches the client.
 *
 * The returned temp password is displayed once in a modal the supervisor must
 * dismiss deliberately; it cannot be retrieved again afterward.
 */
export default function RegisterWorkerScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<RegisterWorkerResult | null>(null);

  const { data: projects, loading } = useAsync(() => fetchProjects(), []);

  async function submit() {
    if (!fullName.trim()) {
      setError("Enter the worker's full name.");
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setError("Enter the worker's phone number.");
      return;
    }
    if (!projectId) {
      setError('Pick the primary site for this worker.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const result = await registerWorker({
        full_name: fullName.trim(),
        phone: phone.trim(),
        project_id: projectId,
      });
      setCredentials(result);
      setFullName('');
      setPhone('');
      setProjectId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register the worker.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScreenBody>
        <Section title="New worker">
          {error ? <ErrorNote message={error} /> : null}
          <Card style={{ padding: spacing.xl }}>
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Juan Dela Cruz"
              autoCapitalize="words"
            />
            <Field
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
              hint="Contact info only — their User ID is generated separately, next screen."
            />

            <Text style={[type.label, { marginBottom: 6 }]}>Primary site</Text>
            {loading ? (
              <Loader />
            ) : (projects?.length ?? 0) === 0 ? (
              <EmptyState title="No sites available" body="Add a site before registering workers." />
            ) : (
              <View style={s.siteList}>
                {projects!.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setProjectId(p.id)}
                    style={[s.siteRow, projectId === p.id && s.siteRowActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.siteName}>{p.name}</Text>
                      {p.location ? <Text style={s.siteSub}>{p.location}</Text> : null}
                    </View>
                    <View style={[s.radio, projectId === p.id && s.radioActive]} />
                  </Pressable>
                ))}
              </View>
            )}

            <PrimaryButton
              label={busy ? 'Registering…' : 'Register worker'}
              onPress={submit}
              loading={busy}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        </Section>

        <View style={s.note}>
          <LockIcon size={18} color={colors.steel} />
          <Text style={s.noteText}>
            A temporary password is generated on the server and shown to you{' '}
            <Text style={s.noteStrong}>once</Text>. Write it down or share it with the worker
            immediately — it cannot be retrieved later.
          </Text>
        </View>
      </ScreenBody>

      {/* -------------------- One-time credentials modal ------------------ */}
      <Modal visible={!!credentials} transparent animationType="fade">
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
              <Text style={s.sheetTitle}>Worker registered</Text>
              <Text style={s.sheetSub}>
                Share these credentials with the worker now. This is the only time the password is
                shown.
              </Text>

              <View style={s.credBox}>
                <Text style={s.credLabel}>User ID</Text>
                <Text style={s.credValue} selectable>
                  {credentials?.login_code}
                </Text>
              </View>
              <View style={s.credBox}>
                <Text style={s.credLabel}>Temporary password</Text>
                <Text style={[s.credValue, s.credPassword]} selectable>
                  {credentials?.temp_password}
                </Text>
              </View>

              <Text style={s.tip}>
                The worker signs in on the Worker tab using this User ID and password, then
                completes their face scan and valid ID.
              </Text>

              <PrimaryButton
                label="I've shared these credentials"
                onPress={() => {
                  setCredentials(null);
                  router.back();
                }}
                style={{ marginTop: spacing.lg }}
              />
              <SecondaryButton
                label="Register another worker"
                onPress={() => setCredentials(null)}
                style={{ marginTop: 10 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  siteList: { gap: 8, marginTop: 2 },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 13,
    backgroundColor: colors.paper,
  },
  siteRowActive: { borderColor: colors.safety, borderWidth: 2, backgroundColor: colors.pendingBg },
  siteName: { fontSize: 13.5, fontFamily: fonts.bodyBold, color: colors.ink },
  siteSub: { fontSize: 11.5, color: colors.muted, marginTop: 2, fontFamily: fonts.body },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.line,
  },
  radioActive: { borderColor: colors.safety, backgroundColor: colors.safety },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 13,
    marginBottom: 30,
  },
  noteText: { flex: 1, fontSize: 11.5, color: colors.muted, lineHeight: 17, fontFamily: fonts.body },
  noteStrong: { color: colors.ink, fontFamily: fonts.bodyBold },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,27,24,0.6)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: { backgroundColor: colors.paper, borderRadius: 20, maxHeight: '85%' },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 22, fontWeight: '700', color: colors.ink },
  sheetSub: {
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: spacing.lg,
    fontFamily: fonts.body,
  },
  credBox: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  credLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedOnDark,
    fontFamily: fonts.bodyBold,
    marginBottom: 5,
  },
  credValue: { fontSize: 15, color: '#fff', fontFamily: fonts.bodySemi },
  credPassword: { fontSize: 20, color: colors.safety, letterSpacing: 1.5 },
  tip: { fontSize: 11.5, color: colors.muted, lineHeight: 17, marginTop: 6, fontFamily: fonts.body },
});

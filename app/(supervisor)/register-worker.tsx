import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAsync } from '../../src/lib/useAsync';
import { fetchProjects, registerWorker } from '../../src/lib/queries';
import type { RegisterWorkerResult } from '../../src/lib/types';
import { LockIcon } from '../../src/components/icons';
import { useWebTheme } from '../../src/web/webTheme';
import {
  GlassButton,
  GlassCard,
  GlassErrorBanner,
  GlassField,
  GlassOutlineButton,
  GlassScreen,
} from '../../src/web/webUi';

/**
 * Registers a worker through the `waa-register-worker` edge function — the
 * only supported path, since creating the Auth account needs the service-role
 * key and that never touches the client.
 *
 * The returned temp password (and generated User ID) is displayed once in a
 * modal the supervisor must dismiss deliberately; neither can be retrieved
 * again afterward.
 */
export default function RegisterWorkerScreen() {
  const { palette } = useWebTheme();
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
      <GlassScreen>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>New worker</Text>
          {error ? <GlassErrorBanner message={error} /> : null}

          <GlassCard style={{ marginBottom: 16 }}>
            <GlassField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Juan Dela Cruz" autoCapitalize="words" />
            <GlassField
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
              hint="Contact info only — their User ID is generated separately, next screen."
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.muted, marginBottom: 8 }}>PRIMARY SITE</Text>
            {loading ? (
              <Text style={{ color: palette.muted, paddingVertical: 8 }}>Loading sites…</Text>
            ) : (projects?.length ?? 0) === 0 ? (
              <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17 }}>
                No sites available. Add a site before registering workers.
              </Text>
            ) : (
              <View style={{ gap: 8, marginBottom: 16 }}>
                {projects!.map((p) => {
                  const active = projectId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setProjectId(p.id)}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          borderWidth: 1,
                          borderColor: active ? palette.accent2 : palette.border,
                          backgroundColor: active ? palette.hover : 'transparent',
                          borderRadius: 13,
                          padding: 13,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>{p.name}</Text>
                        {p.location ? <Text style={{ fontSize: 11.5, color: palette.muted, marginTop: 2 }}>{p.location}</Text> : null}
                      </View>
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: active ? palette.accent2 : palette.border,
                          backgroundColor: active ? palette.accent2 : 'transparent',
                        }}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}

            <GlassButton label={busy ? 'Registering…' : 'Register worker'} onPress={submit} loading={busy} />
          </GlassCard>

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: palette.panel, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.border, borderRadius: 14, padding: 13, marginBottom: 30 }}>
            <LockIcon size={18} color={palette.muted} />
            <Text style={{ flex: 1, fontSize: 11.5, color: palette.muted, lineHeight: 17 }}>
              A temporary password is generated on the server and shown to you{' '}
              <Text style={{ color: palette.text, fontWeight: '700' }}>once</Text>. Write it down or share it with the
              worker immediately — it cannot be retrieved later.
            </Text>
          </View>
        </ScrollView>
      </GlassScreen>

      {/* -------------------- One-time credentials modal ------------------ */}
      <Modal visible={!!credentials} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: palette.panelSolid, borderWidth: 1, borderColor: palette.border, borderRadius: 20, maxHeight: '85%' }}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Worker registered</Text>
              <Text style={{ fontSize: 12.5, color: palette.muted, lineHeight: 18, marginTop: 4, marginBottom: 16 }}>
                Share these credentials with the worker now. This is the only time the password is shown.
              </Text>

              <View style={{ backgroundColor: palette.hover, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1, color: palette.muted, fontWeight: '700', marginBottom: 5 }}>USER ID</Text>
                <Text style={{ fontSize: 15, color: palette.text, fontWeight: '600' }} selectable>
                  {credentials?.login_code}
                </Text>
              </View>
              <View style={{ backgroundColor: palette.hover, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1, color: palette.muted, fontWeight: '700', marginBottom: 5 }}>TEMPORARY PASSWORD</Text>
                <Text style={{ fontSize: 20, color: palette.accent2, fontWeight: '700', letterSpacing: 1.5 }} selectable>
                  {credentials?.temp_password}
                </Text>
              </View>

              <Text style={{ fontSize: 11.5, color: palette.muted, lineHeight: 17, marginTop: 6 }}>
                The worker signs in on the Worker tab using this User ID and password, then
                completes their face scan and valid ID.
              </Text>

              <GlassButton
                label="I've shared these credentials"
                onPress={() => {
                  setCredentials(null);
                  router.back();
                }}
                style={{ marginTop: 16 }}
              />
              <GlassOutlineButton label="Register another worker" onPress={() => setCredentials(null)} style={{ marginTop: 10 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

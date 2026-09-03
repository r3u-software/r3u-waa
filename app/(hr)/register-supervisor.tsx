/*
 * Registers a supervisor through the `waa-register-supervisor` edge function —
 * the only supported path, since creating the Auth account needs the
 * service-role key. Reached from Roster's "Register a supervisor" button —
 * the header comment this file used to carry ("ORPHANED SCREEN — not
 * reachable") predates that wiring and is stale.
 *
 * Reskinned onto the glass system — R3U-WAA-WEB-REDESIGN.md's follow-up.
 */
import React, { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { registerSupervisor } from '../../src/lib/queries';
import type { RegisterSupervisorResult } from '../../src/lib/types';
import { LockIcon } from '../../src/components/icons';
import { useWebTheme } from '../../src/web/webTheme';
import { GlassButton, GlassCard, GlassErrorBanner, GlassField, GlassOutlineButton, GlassScreen } from '../../src/web/webUi';

export default function RegisterSupervisorScreen() {
  const { palette } = useWebTheme();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<RegisterSupervisorResult | null>(null);

  async function submit() {
    if (!fullName.trim()) {
      setError("Enter the supervisor's full name.");
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setError('Enter a valid phone number — it becomes their login.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const result = await registerSupervisor({
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      setCredentials(result);
      setFullName('');
      setPhone('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register the supervisor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <GlassScreen>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>New supervisor</Text>
          {error ? <GlassErrorBanner message={error} /> : null}
          <GlassCard style={{ marginBottom: 16 }}>
            <GlassField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Ana Reyes" autoCapitalize="words" />
            <GlassField
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
              hint="This becomes their login identifier. Double-check it."
            />
            <GlassButton label={busy ? 'Registering…' : 'Register supervisor'} onPress={submit} loading={busy} />
          </GlassCard>

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: palette.panel, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.border, borderRadius: 14, padding: 13 }}>
            <LockIcon size={18} color={palette.muted} />
            <Text style={{ flex: 1, fontSize: 11.5, color: palette.muted, lineHeight: 17 }}>
              A temporary password is generated on the server and shown to you <Text style={{ color: palette.text, fontWeight: '700' }}>once</Text>. Provisioning is
              top-down: you create supervisors, and each supervisor registers their own workers.
            </Text>
          </View>
        </ScrollView>
      </GlassScreen>

      {/* -------------------- One-time credentials modal ------------------ */}
      <Modal visible={!!credentials} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: palette.panelSolid, borderWidth: 1, borderColor: palette.border, borderRadius: 20, maxHeight: '85%' }}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Supervisor registered</Text>
              <Text style={{ fontSize: 12.5, color: palette.muted, lineHeight: 18, marginTop: 4, marginBottom: 16 }}>
                Share these credentials now. This is the only time the password is shown.
              </Text>

              <View style={{ backgroundColor: palette.hover, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1, color: palette.muted, fontWeight: '700', marginBottom: 5 }}>LOGIN (PHONE-BASED EMAIL)</Text>
                <Text style={{ fontSize: 15, color: palette.text, fontWeight: '600' }} selectable>
                  {credentials?.login_email}
                </Text>
              </View>
              <View style={{ backgroundColor: palette.hover, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1, color: palette.muted, fontWeight: '700', marginBottom: 5 }}>TEMPORARY PASSWORD</Text>
                <Text style={{ fontSize: 20, color: palette.accent2, fontWeight: '700', letterSpacing: 1.5 }} selectable>
                  {credentials?.temp_password}
                </Text>
              </View>

              <Text style={{ fontSize: 11.5, color: palette.muted, lineHeight: 17, marginTop: 6 }}>
                They sign in on the Supervisor tab using this full address — not just the digits — and this password.
              </Text>

              <GlassButton
                label="I've shared these credentials"
                onPress={() => {
                  setCredentials(null);
                  router.back();
                }}
                style={{ marginTop: 16 }}
              />
              <GlassOutlineButton label="Register another supervisor" onPress={() => setCredentials(null)} style={{ marginTop: 10 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { useSession } from '../src/lib/session';
import { WebThemeProvider } from '../src/web/webTheme';
import {
  AuthShell,
  GlassButton,
  GlassCallout,
  GlassErrorBanner,
  GlassField,
  GlassFootnote,
  GlassOutlineButton,
} from '../src/web/webUi';

/**
 * HR/Admin profile completion — the step between the forced password reset and
 * the HR/Admin home screen.
 *
 * An HR/Admin account is provisioned by the Platform Owner with nothing on it
 * but a generated `login_code` and a temp password: no name, no email, no
 * phone. This screen collects those three, mirroring the profile-completion
 * step Workers already go through after a supervisor registers them.
 *
 * Guard treatment is identical to /change-password: the root guard in
 * `_layout.tsx` parks any HR/Admin whose row still reads
 * `profile_complete = false` here, ahead of the (hr) redirect, so this screen
 * is not reachable by choice and cannot be navigated past. It is HR/Admin-only
 * — Worker and Supervisor never reach it; their own onboarding is unchanged and
 * lives inside their own route groups. HR/Admin is web-only, so unlike the
 * other three auth screens this one in practice only ever renders on web —
 * it still shares the same `AuthShell` chrome for consistency either way.
 *
 * The write goes through the `waa_hr_admins_update_own` RLS policy
 * (`auth_user_id = auth.uid()`) rather than an edge function: unlike the
 * payroll surface, none of these three fields is a pay figure or crosses a
 * company boundary, and the row being written is the caller's own.
 *
 * `login_code` is deliberately absent from the form. It is fixed at account
 * creation and is the person's only way to sign in — it is shown read-only
 * below so they can write it down, never as an editable field.
 */
export default function CompleteProfileScreen() {
  const { hrAdmin, refreshProfile, signOut } = useSession();

  const [fullName, setFullName] = useState(hrAdmin?.full_name ?? '');
  const [email, setEmail] = useState(hrAdmin?.email ?? '');
  const [phone, setPhone] = useState(hrAdmin?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    if (!hrAdmin) {
      setError('Your HR/Admin record could not be read. Sign out and sign in again.');
      return;
    }

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError('Enter your full name.');
      return;
    }
    if (!trimmedEmail) {
      setError('Enter a contact email address.');
      return;
    }
    // Deliberately loose: this is contact information, not a login, so it is
    // never resolved against Auth. A typo here locks nobody out.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('That email address does not look right.');
      return;
    }
    if (trimmedPhone.replace(/\D/g, '').length < 7) {
      setError('Enter a contact phone number.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase
        .from('waa_hr_admins')
        .update({
          full_name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          profile_complete: true,
        })
        .eq('id', hrAdmin.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Re-resolves the role row, which now reads profile_complete = true. The
      // root guard reacts to that and routes on to /(hr) itself — the same
      // mechanism /change-password uses after clearing its own flag.
      await refreshProfile();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <WebThemeProvider>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <AuthShell
            eyebrow="R3U SITE SUITE"
            title="Complete your profile"
            tagline="Your account was created for you with a login code only. Add your details to finish setting it up."
          >
            {error ? <GlassErrorBanner message={error} /> : null}

            {hrAdmin?.login_code ? (
              <GlassCallout
                label="YOUR LOGIN ID"
                value={hrAdmin.login_code}
                note="Save this — it is how you sign in from now on, and it never changes. The email below is contact information only, not a second way in."
              />
            ) : null}

            <GlassField
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Maria Santos"
              autoCapitalize="words"
              autoCorrect={false}
            />

            <GlassField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              hint="Where R3U can reach you. Not used to sign in."
            />

            <GlassField
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
            />

            <GlassButton label="Save and continue" onPress={submit} loading={busy} />
            <GlassOutlineButton label="Sign out" onPress={signOut} style={{ marginTop: 10 }} />

            <GlassFootnote>This is the only screen available until your profile is complete.</GlassFootnote>
          </AuthShell>
        </ScrollView>
      </KeyboardAvoidingView>
    </WebThemeProvider>
  );
}

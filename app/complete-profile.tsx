import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { useSession } from '../src/lib/session';
import { colors, fonts, radius, spacing } from '../src/theme';
import { ErrorNote, Field, PrimaryButton, SecondaryButton } from '../src/components/ui';
import { IdCardIcon } from '../src/components/icons';

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
 * lives inside their own route groups.
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
  const insets = useSafeAreaInsets();
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
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 48 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.brandMark}>
          <IdCardIcon size={24} color={colors.safety} />
        </View>
        <Text style={s.co}>R3U Site Suite</Text>
        <Text style={s.title}>Complete your profile</Text>
        <Text style={s.tagline}>
          Your account was created for you with a login code only. Add your details to finish
          setting it up.
        </Text>

        <View style={s.card}>
          {error ? <ErrorNote message={error} /> : null}

          {hrAdmin?.login_code ? (
            <View style={s.codeBox}>
              <Text style={s.codeLabel}>Your login ID</Text>
              <Text style={s.codeValue} selectable>
                {hrAdmin.login_code}
              </Text>
              <Text style={s.codeHint}>
                Save this — it is how you sign in from now on, and it never changes. The email
                below is contact information only, not a second way in.
              </Text>
            </View>
          ) : null}

          <Field
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Maria Santos"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Where R3U can reach you. Not used to sign in."
          />

          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="09XX XXX XXXX"
            keyboardType="phone-pad"
          />

          <PrimaryButton
            label={busy ? 'Saving…' : 'Save and continue'}
            onPress={submit}
            loading={busy}
          />

          <SecondaryButton label="Sign out" onPress={signOut} style={{ marginTop: 10 }} />

          <Text style={s.footnote}>
            This is the only screen available until your profile is complete.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.xl, paddingBottom: 60, alignItems: 'stretch' },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  co: {
    fontSize: 10.5,
    letterSpacing: 1.3,
    color: colors.muted,
    fontFamily: fonts.bodyBold,
    textAlign: 'center',
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 27,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 2,
  },
  tagline: {
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing.xxl,
    lineHeight: 18,
    fontFamily: fonts.body,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.hero,
    padding: spacing.xl,
  },
  codeBox: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: spacing.lg,
  },
  codeLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedOnDark,
    fontFamily: fonts.bodyBold,
    marginBottom: 5,
  },
  codeValue: { fontSize: 20, color: colors.safety, letterSpacing: 1.5, fontFamily: fonts.bodyBold },
  codeHint: {
    fontSize: 11,
    color: colors.mutedOnDark,
    lineHeight: 16,
    marginTop: 7,
    fontFamily: fonts.body,
  },
  footnote: {
    fontSize: 11.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 17,
    fontFamily: fonts.body,
  },
});

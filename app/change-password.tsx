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
import { LockIcon } from '../src/components/icons';

/** Deliberately modest — matched to what Supabase Auth itself will accept. */
const MIN_LENGTH = 8;

/**
 * Forced password reset, shared by all three roles.
 *
 * The root guard in `_layout.tsx` parks any signed-in account whose role row
 * still has `must_change_password = true` here, ahead of every role redirect —
 * so this screen is not reachable by choice and cannot be navigated past.
 * There is no per-role branching: the guard sends whoever completes it to the
 * right home group on its own.
 *
 * Two steps, in this order and never the other way round:
 *   1. `auth.updateUser({ password })` actually rotates the credential.
 *   2. `waa_complete_password_reset()` (SECURITY DEFINER, no arguments) clears
 *      the flag on whichever role table matches the caller.
 *
 * Step 2 only ever runs after step 1 came back clean, which is the whole point
 * of the RPC existing rather than the client updating the column itself. If
 * step 2 fails on its own the password IS already changed, so the screen says
 * exactly that and offers a sign-out: signing back in with the NEW password
 * lands here again (the flag never cleared), which is a retry, not a dead end.
 */
export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { refreshProfile, signOut } = useSession();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set only in the "password changed but flag still set" half-state. */
  const [stranded, setStranded] = useState(false);

  async function submit() {
    setError(null);

    if (!password) {
      setError('Enter a new password.');
      return;
    }
    if (password.length < MIN_LENGTH) {
      setError(`Your new password needs at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      const { error: rpcError } = await supabase.rpc('waa_complete_password_reset');
      if (rpcError) {
        // The credential itself is already rotated — don't imply otherwise.
        setStranded(true);
        setError(
          'Your password was changed, but we could not finish setting up your account. ' +
            'Sign out and sign back in with your NEW password to try again.'
        );
        return;
      }

      // Re-resolves the role row, which now reads must_change_password = false.
      // The root guard reacts to that and routes to this role's home itself.
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
          <LockIcon size={24} color={colors.safety} />
        </View>
        <Text style={s.co}>R3U Site Suite</Text>
        <Text style={s.title}>Set a new password</Text>
        <Text style={s.tagline}>
          You are signed in with a temporary password. Choose your own before you continue.
        </Text>

        <View style={s.card}>
          {error ? <ErrorNote message={error} /> : null}

          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            hint={`At least ${MIN_LENGTH} characters. Don't reuse the one you were given.`}
          />

          <Field
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
          />

          <PrimaryButton
            label={busy ? 'Saving…' : 'Save and continue'}
            onPress={submit}
            loading={busy}
            disabled={stranded}
          />

          <SecondaryButton
            label="Sign out"
            onPress={signOut}
            style={{ marginTop: 10 }}
          />

          <Text style={s.footnote}>
            This is the only screen available until your password is changed.
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
  footnote: {
    fontSize: 11.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 17,
    fontFamily: fonts.body,
  },
});

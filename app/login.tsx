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
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../src/lib/supabase';
import { useSession } from '../src/lib/session';
import { colors, fonts, radius, spacing } from '../src/theme';
import { ErrorNote, Field, PrimaryButton } from '../src/components/ui';
import { SiteIcon } from '../src/components/icons';

/**
 * One form for all four roles — no role switcher.
 *
 * The person types whatever identifier they were given (Worker and Supervisor
 * a phone number, HR/Admin a generated login code such as `HR-521031`,
 * Platform Owner a real email address) and the `waa-resolve-login` edge
 * function decides server-side which identity it belongs to. It resolves four
 * shapes now, not three — but that change was entirely server-side: this form
 * still posts whatever was typed as `identifier` and needed no edit for it.
 *
 * Resolution is deliberately NOT done here: inferring a role from
 * the string's shape would be cosmetic, and looping `signInWithPassword` over
 * candidate addresses client-side would both leak which one nearly matched and
 * burn through Supabase's brute-force protection faster than one real attempt.
 *
 * The function returns either a session or a single generic error, so the error
 * text below is whatever it sent back, verbatim — never reworded per role.
 * Once `setSession` lands, the root guard in `_layout.tsx` resolves the role
 * from the session and routes to the matching group on its own.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { roleError } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError('Enter your phone number, login ID or email.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/waa-resolve-login`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: trimmed, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Already the generic "Incorrect phone/email or password." — show it as
        // sent rather than adding a role-specific hint on top of it.
        setError(
          (data && typeof data.error === 'string' && data.error) ||
            'Could not sign you in. Try again.'
        );
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      // On success the root guard redirects into the right role group.
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
          <SiteIcon size={26} color={colors.safety} />
        </View>
        <Text style={s.co}>R3U Site Suite</Text>
        <Text style={s.title}>Worker's Attendance</Text>
        <Text style={s.tagline}>One Platform. Every Business.</Text>

        <View style={s.card}>
          {roleError ? <ErrorNote message={roleError} /> : null}
          {error ? <ErrorNote message={error} /> : null}

          <Field
            label="Phone, login ID or email"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="09XX XXX XXXX · HR-000000 · you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            hint="Whichever one you were given — we work out the rest."
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
          />

          <PrimaryButton
            label={busy ? 'Signing in…' : 'Sign in'}
            onPress={submit}
            loading={busy}
          />

          <Text style={s.footnote}>
            New here? Ask your supervisor or HR/Admin for your login — there is no self sign-up.
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
    marginTop: 4,
    marginBottom: spacing.xxl,
    fontFamily: fonts.body,
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

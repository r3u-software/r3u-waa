import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../src/lib/supabase';
import { useSession } from '../src/lib/session';
import { WebThemeProvider } from '../src/web/webTheme';
import { AuthShell, GlassButton, GlassErrorBanner, GlassField, GlassFootnote } from '../src/web/webUi';

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
 *
 * Visual layer only, R3U-WAA-WEB-REDESIGN.md's follow-up: renders through
 * `AuthShell` (src/web/webUi.tsx) — the same glass chrome as
 * change-password.tsx / complete-profile.tsx / blocked-use-web.tsx, and on
 * native as well as web (`expo-blur` + `expo-linear-gradient` both ship
 * their own web implementations, so nothing here branches on `Platform.OS`).
 * `WebThemeProvider` is mounted fresh right here rather than inherited: there
 * is no session yet at this point, so no per-user theme choice to read
 * (that context otherwise only lives inside `(hr)`/`(platform-owner)`'s own
 * layouts) — it defaults to Aurora/dark, same as every other auth screen.
 */
export default function LoginScreen() {
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
    <WebThemeProvider>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <AuthShell eyebrow="R3U SITE SUITE" title="Worker's Attendance" tagline="One Platform. Every Business.">
            {roleError ? <GlassErrorBanner message={roleError} /> : null}
            {error ? <GlassErrorBanner message={error} /> : null}

            <GlassField
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

            <GlassField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
            />

            <GlassButton label="Sign in" onPress={submit} loading={busy} />

            <GlassFootnote>
              New here? Ask your supervisor or HR/Admin for your login — there is no self sign-up.
            </GlassFootnote>
          </AuthShell>
        </ScrollView>
      </KeyboardAvoidingView>
    </WebThemeProvider>
  );
}

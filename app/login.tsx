import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../src/lib/supabase';
import { useSession } from '../src/lib/session';
import { WebThemeProvider } from '../src/web/webTheme';
import { AuthShell, GlassButton, GlassErrorBanner, GlassField, GlassFootnote } from '../src/web/webUi';

/**
 * One form for all four roles — no role switcher.
 *
 * The person types their "User ID" — a generated code (Worker `WK-521031`,
 * Supervisor `SV-521031`, HR/Admin `HR-521031`; Platform Owner is the one
 * exception, still a real email, since that's the single standing account,
 * not an auto-provisioned one) — and the `waa-resolve-login` edge function
 * decides server-side which identity it belongs to. This field also still
 * quietly resolves a legacy phone number for Worker/Supervisor accounts
 * that predate the login_code rollout — never shown as an option here, kept
 * server-side only so nobody already using one gets locked out. This form
 * always just posts whatever was typed as `identifier`, unchanged by any of
 * that — resolution happens entirely server-side, not here.
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
 * No biometric quick sign-in here — that existed for one day (2026-09-03)
 * and was removed the same day, per an explicit "I'm done with biometrics
 * login, better remove it" after it went through three separate bug reports
 * on a real device (the toggle reverting, a misleading passcode icon, and
 * finally the actual root cause — Supabase rotating the refresh token out
 * from under a one-time snapshot) and repeated EAS build failures on
 * Expo's own infrastructure stacked on top. `expo-secure-store` and
 * `src/lib/biometricAuth.ts` are gone with it; `expo-local-authentication`
 * stays in package.json — it predates this feature and is what
 * `Worker Contribution & Benefits` and the original build brief's
 * punch-confirmation biometric gate are meant to use, a separate,
 * not-yet-built feature this removal has no reason to touch.
 *
 * Visual layer, R3U-WAA-WEB-REDESIGN.md's follow-up: renders through
 * `AuthShell` (src/web/webUi.tsx) — the same glass chrome as
 * change-password.tsx / complete-profile.tsx / blocked-use-web.tsx, and on
 * native as well as web (`expo-blur` + `expo-linear-gradient` both ship
 * their own web implementations, so nothing here branches on `Platform.OS`
 * for the chrome itself).
 *
 * `LoginForm` is split out from `LoginScreen` so it can call `useWebTheme()`
 * — only valid *inside* `WebThemeProvider`, which is mounted fresh right
 * here rather than inherited: there is no session yet at this point, so no
 * per-user theme choice to read (that context otherwise only lives inside
 * `(hr)`/`(worker)`/`(supervisor)`/`(platform-owner)`'s own layouts) — it
 * starts from 'system' mode / Aurora, same default as everywhere else.
 */
export default function LoginScreen() {
  return (
    <WebThemeProvider>
      <LoginForm />
    </WebThemeProvider>
  );
}

function LoginForm() {
  const { roleError } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError('Enter your User ID.');
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
        // Already the generic "Incorrect User ID or password." — show it as
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <AuthShell eyebrow="R3U SITE SUITE" title="Worker's Attendance" tagline="One Platform. Every Business.">
          {roleError ? <GlassErrorBanner message={roleError} /> : null}
          {error ? <GlassErrorBanner message={error} /> : null}

          <GlassField
            label="User ID"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Enter your User ID"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            hint="Ask your supervisor or HR/Admin if you don't have one."
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
  );
}

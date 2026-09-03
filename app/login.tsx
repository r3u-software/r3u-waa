import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../src/lib/supabase';
import { useSession } from '../src/lib/session';
import {
  authenticateWithBiometrics,
  BiometricRecord,
  clearBiometricSession,
  isBiometricAvailable,
  loadBiometricSession,
  saveBiometricSession,
  supportedBiometricTypes,
} from '../src/lib/biometricAuth';
import { FaceIdIcon, FingerprintIcon, PasscodeIcon } from '../src/components/icons';
import { useWebTheme, WebThemeProvider } from '../src/web/webTheme';
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
 * Biometric quick sign-in is opt-in from Profile's "Sign-in & security"
 * toggle (`BiometricToggle`, `src/web/webUi.tsx`) now, not offered here —
 * "it should ask for the first time login only. not always. better dont
 * ask, it should be a toggle." This screen only ever *reads* whatever was
 * already turned on there: three tappable icons (Face ID / fingerprint /
 * phone passcode) shown only once a record exists, each icon shown only if
 * the device actually reports that capability. All three call the same
 * `authenticateAsync()` under the hood — neither platform lets an app force
 * "face only" or "fingerprint only" out of the one system prompt, so the
 * icons are honest about *availability*, not independent code paths (see
 * `supportedBiometricTypes()`'s doc comment).
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
  const { palette } = useWebTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bioRecord, setBioRecord] = useState<BiometricRecord | null>(null);
  const [bioTypes, setBioTypes] = useState({ face: false, fingerprint: false });
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [available, record, types] = await Promise.all([
        isBiometricAvailable(),
        loadBiometricSession(),
        supportedBiometricTypes(),
      ]);
      if (!active) return;
      setBioRecord(available ? record : null);
      setBioTypes(types);
    })();
    return () => {
      active = false;
    };
  }, []);

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
      // On success the root guard redirects into the right role group. No
      // biometric opt-in offer here any more — that lives in Profile now.
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithBiometrics() {
    if (!bioRecord) return;
    setError(null);
    setBioBusy(true);
    try {
      const ok = await authenticateWithBiometrics(`Sign in as ${bioRecord.identifierLabel}`);
      if (!ok) return; // Cancelled or failed the prompt — say nothing, stay put.

      const { data, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: bioRecord.refreshToken,
      });
      if (refreshError || !data.session) {
        // The stored token is dead (expired, or revoked by an explicit sign-out
        // elsewhere) — stop offering a quick-login button that will only fail.
        await clearBiometricSession();
        setBioRecord(null);
        setError('Your saved sign-in has expired. Enter your password to continue, then turn quick sign-in back on from Profile.');
        return;
      }

      // Supabase rotates the refresh token on every use — keep the saved
      // copy current so the *next* biometric attempt still works.
      await saveBiometricSession({
        identifierLabel: bioRecord.identifierLabel,
        refreshToken: data.session.refresh_token,
      });
      // Root guard takes it from here.
    } catch {
      setError('Could not sign you in. Try again or use your password.');
    } finally {
      setBioBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <AuthShell eyebrow="R3U SITE SUITE" title="Worker's Attendance" tagline="One Platform. Every Business.">
          {roleError ? <GlassErrorBanner message={roleError} /> : null}
          {error ? <GlassErrorBanner message={error} /> : null}

          {bioRecord ? (
            <>
              <Text style={{ fontSize: 12, color: palette.muted, textAlign: 'center', marginBottom: 10 }}>
                Continue as <Text style={{ fontWeight: '700', color: palette.text }}>{bioRecord.identifierLabel}</Text>
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
                {bioTypes.face ? (
                  <BioIconButton icon={FaceIdIcon} busy={bioBusy} disabled={busy} onPress={signInWithBiometrics} palette={palette} />
                ) : null}
                {bioTypes.fingerprint ? (
                  <BioIconButton icon={FingerprintIcon} busy={bioBusy} disabled={busy} onPress={signInWithBiometrics} palette={palette} />
                ) : null}
                <BioIconButton icon={PasscodeIcon} busy={bioBusy} disabled={busy} onPress={signInWithBiometrics} palette={palette} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
                <Text style={{ fontSize: 11, color: palette.muted, fontWeight: '700' }}>OR SIGN IN WITH PASSWORD</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
              </View>
            </>
          ) : null}

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

          <GlassButton label="Sign in" onPress={submit} loading={busy} disabled={bioBusy} />

          <GlassFootnote>
            New here? Ask your supervisor or HR/Admin for your login — there is no self sign-up.
          </GlassFootnote>
        </AuthShell>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One circular icon button in the quick-sign-in row. All three (Face ID /
 * fingerprint / passcode) call the same handler — see the module doc
 * comment above for why that's an honest choice, not a shortcut. */
function BioIconButton({
  icon: Icon,
  onPress,
  busy,
  disabled,
  palette,
}: {
  icon: typeof FaceIdIcon;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
  palette: { border: string; panelSolid: string; accent2: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        {
          width: 56,
          height: 56,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.panelSolid,
          alignItems: 'center',
          justifyContent: 'center',
        },
        (busy || disabled) && { opacity: 0.55 },
        pressed && !(busy || disabled) && { opacity: 0.85 },
      ]}
    >
      {busy ? <ActivityIndicator color={palette.accent2} /> : <Icon color={palette.accent2} size={24} />}
    </Pressable>
  );
}

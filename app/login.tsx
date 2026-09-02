import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../src/lib/supabase';
import { useSession } from '../src/lib/session';
import { resolvePalette } from '../src/web/webTheme';

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
 * Visual layer only, R3U-WAA-WEB-REDESIGN.md's follow-up: this is the one
 * screen every role sees on every platform, so unlike the rest of that pass
 * (web-only), it now carries the glass look on native too — `expo-blur` +
 * `expo-linear-gradient`, the two new dependencies that made that possible.
 * It intentionally still uses a fixed Aurora/dark palette rather than
 * `useWebTheme()`: there is no session yet at this point, so no
 * `WebThemeProvider` is mounted (that context lives inside `(hr)` and
 * `(platform-owner)`'s own layouts), and a login screen isn't where a
 * returning user would expect to find their theme switcher anyway. One
 * acknowledged seam this leaves: Worker/Supervisor land here in the same
 * glass look, then the very next screen (their actual native Home/Pay/etc.)
 * is still the original paper theme — reskinning those screens is a
 * separate, materially bigger piece of work that was not commissioned here.
 */

const P = resolvePalette('aurora', 'dark');

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
    <View style={s.root}>
      <LinearGradient colors={[P.bg, P.bg2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={s.glowA} />
      <View pointerEvents="none" style={s.glowB} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.content, { paddingTop: insets.top + 48 }]}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient colors={[P.accent, P.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.brandMark}>
            <Text style={s.brandMarkText}>R3</Text>
          </LinearGradient>
          <Text style={s.co}>R3U SITE SUITE</Text>
          <Text style={s.title}>Worker's Attendance</Text>
          <Text style={s.tagline}>One Platform. Every Business.</Text>

          <BlurView intensity={44} tint="dark" style={s.card}>
            {roleError ? <ErrorBanner message={roleError} /> : null}
            {error ? <ErrorBanner message={error} /> : null}

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

            <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [s.submitWrap, pressed && !busy && { opacity: 0.85 }]}>
              <LinearGradient colors={[P.accent, P.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submit}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Sign in</Text>}
              </LinearGradient>
            </Pressable>

            <Text style={s.footnote}>
              New here? Ask your supervisor or HR/Admin for your login — there is no self sign-up.
            </Text>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={s.errorBox}>
      <Text style={s.errorText}>{message}</Text>
    </View>
  );
}

function GlassField({
  label,
  hint,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={P.muted} {...props} style={s.input} />
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg, overflow: 'hidden' },
  flex: { flex: 1 },
  content: { padding: 22, paddingBottom: 60, alignItems: 'stretch', width: '100%', maxWidth: 440, alignSelf: 'center' },
  glowA: {
    position: 'absolute',
    top: -140,
    left: -120,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: P.accent,
    opacity: 0.22,
  },
  glowB: {
    position: 'absolute',
    top: 60,
    right: -140,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: P.accent2,
    opacity: 0.14,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  brandMarkText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  co: { fontSize: 11, letterSpacing: 1.6, color: P.muted, fontWeight: '700', textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: P.text, textAlign: 'center', marginTop: 4 },
  tagline: { fontSize: 12.5, color: P.muted, textAlign: 'center', marginTop: 4, marginBottom: 28 },
  card: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: P.border,
    overflow: 'hidden',
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  fieldHint: { fontSize: 11.5, color: P.muted, marginTop: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14.5,
    color: P.text,
  },
  submitWrap: { marginTop: 6, borderRadius: 14, overflow: 'hidden' },
  submit: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  footnote: { fontSize: 11.5, color: P.muted, textAlign: 'center', marginTop: 16, lineHeight: 17 },
  errorBox: { backgroundColor: P.badBg, borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { color: P.bad, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
});

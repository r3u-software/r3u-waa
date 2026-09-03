import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

/**
 * "Fingerprint, facial recognition, phone passcode — sign in fast; if the
 * phone has none of that, type your user id and password" — the login
 * screen's quick-login path.
 *
 * `LocalAuthentication.authenticateAsync()` already covers all three: it
 * shows Face ID/Touch ID/Android biometric first, and — unless
 * `disableDeviceFallback` is set — falls back to the phone's own lock-screen
 * passcode/pattern/PIN on its own if biometrics fail or aren't enrolled. One
 * call, one native prompt, exactly the three options the phrasing describes.
 *
 * What it gates is a Supabase refresh token, not the account's actual
 * password — the password itself is never written to disk here. The token
 * lives in `expo-secure-store` (iOS Keychain / Android Keystore-backed
 * EncryptedSharedPreferences), which is what SecureStore exists for: a small
 * secret that must survive app restarts but never be readable outside this
 * app, even if the device's regular storage were extracted. Wrapping the
 * *read* of that token behind a biometric/passcode prompt is what makes it a
 * "biometric login" rather than a plain "remember me" — anyone with the
 * unlocked phone but not the enrolled fingerprint/passcode can't use it.
 */

const RECORD_KEY = 'r3u-waa-biometric-session';

export interface BiometricRecord {
  /** Whatever the person typed at their last password sign-in — phone
   * number, HR login code, or email. Shown back as "Continue as …" so the
   * quick-login button isn't anonymous. Never the password itself. */
  identifierLabel: string;
  refreshToken: string;
}

/** Native-only: SecureStore has no meaningful web implementation, and
 * "fingerprint / facial recognition / phone passcode" is native-device
 * phrasing to begin with — HR/Admin and Platform Owner, the only roles that
 * ever run on web, never see this flow at all. */
export function biometricLoginSupported(): boolean {
  return Platform.OS !== 'web';
}

/** Hardware present AND something is actually enrolled on it — capability
 * without enrollment (a phone with a fingerprint sensor nobody registered a
 * finger on) should behave exactly like no hardware at all. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!biometricLoginSupported()) return false;
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

/**
 * Which enrolled methods the OS reports (a device can genuinely have more
 * than one — face and fingerprint both enrolled). Drives which icons the
 * login screen shows: no point offering a Face ID button on a
 * fingerprint-only phone. This does NOT let a tap force "face only" or
 * "fingerprint only" — neither iOS's nor Android's system biometric prompt
 * exposes that choice to an app; whichever icon is tapped still opens the
 * one OS prompt, which itself decides what to show (and still falls back to
 * the device passcode if biometrics fail or are cancelled). The three icons
 * are honest about *availability*, not independent code paths.
 */
export async function supportedBiometricTypes(): Promise<{ face: boolean; fingerprint: boolean }> {
  if (!biometricLoginSupported()) return { face: false, fingerprint: false };
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return {
      face: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
      fingerprint: types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
    };
  } catch {
    return { face: false, fingerprint: false };
  }
}

/** Runs the native prompt. Resolves `true` only on an actual success —
 * cancel, lockout, and "not available" all resolve `false` rather than
 * throwing, so callers never need a try/catch just to handle "the person hit
 * Cancel". */
export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  if (!biometricLoginSupported()) return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use password instead',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Called once, right after a normal password sign-in succeeds, if the
 * person opted in. Overwrites whatever record was there before — a device
 * only ever remembers the one most-recently-signed-in account, which is the
 * one thing "Continue as …" should ever offer. */
export async function saveBiometricSession(record: BiometricRecord): Promise<void> {
  if (!biometricLoginSupported()) return;
  try {
    await SecureStore.setItemAsync(RECORD_KEY, JSON.stringify(record));
  } catch {
    // Keychain/Keystore unavailable for some reason — the person just gets
    // asked for their password again next time, same as if they'd declined.
  }
}

export async function loadBiometricSession(): Promise<BiometricRecord | null> {
  if (!biometricLoginSupported()) return null;
  try {
    const raw = await SecureStore.getItemAsync(RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.identifierLabel === 'string' && typeof parsed?.refreshToken === 'string') {
      return parsed as BiometricRecord;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Turns quick sign-in on, from inside the app (Profile's "Sign-in &
 * Security" toggle) rather than as a nag after every password login —
 * "it should ask for the first time login only. not always. better dont
 * ask, it should be a toggle off/on in the settings." The person is already
 * signed in when they flip this on, so there's no fresh password submit to
 * hook: this reads the *current* session's own refresh token directly and
 * confirms with one biometric prompt before storing it, same confirmation
 * step the old post-login prompt used to do.
 */
export async function enableBiometricLogin(identifierLabel: string): Promise<boolean> {
  const ok = await authenticateWithBiometrics('Confirm to enable quick sign-in');
  if (!ok) return false;
  const { data } = await supabase.auth.getSession();
  const refreshToken = data.session?.refresh_token;
  if (!refreshToken) return false;
  await saveBiometricSession({ identifierLabel, refreshToken });
  return true;
}

/** Forgets this device. Called from the explicit "Sign out" button (not the
 * 5-minute idle timeout — see `useSession().signOut` vs `idleSignOut`) and
 * whenever a stored refresh token turns out to already be dead, so a revoked
 * or expired record doesn't keep re-offering a quick-login button that will
 * only fail again. */
export async function clearBiometricSession(): Promise<void> {
  if (!biometricLoginSupported()) return;
  try {
    await SecureStore.deleteItemAsync(RECORD_KEY);
  } catch {
    // Nothing to do — worst case the stale record lingers and the next
    // attempt to use it fails and clears itself via the path above.
  }
}

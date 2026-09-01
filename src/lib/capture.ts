import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';
import { File } from 'expo-file-system';
import { Alert } from 'react-native';

/**
 * Thin wrappers over the device capability modules. Each returns a plain
 * result rather than throwing, so screens can branch without try/catch noise.
 */

/** Opens the front camera for a selfie. Returns the local URI, or null if cancelled. */
export async function captureSelfie(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      'Camera permission needed',
      'R3U Attendance needs your camera to take the selfie that verifies each time punch.'
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.front,
    quality: 0.6,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/** Camera capture for a document (valid ID / contract page) — rear camera. */
export async function captureDocument(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera permission needed', 'Allow camera access to photograph your valid ID.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.back,
    quality: 0.7,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/** Picks an existing image from the library. */
export async function pickImageFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos permission needed', 'Allow photo access to upload an existing image.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/**
 * Opens the system document picker filtered to PDFs. Used by supervisors to
 * attach a signed contract — expo-file-system ships this natively, so no
 * separate document-picker dependency is needed.
 */
export async function pickPdf(): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: 'application/pdf' });
  if (picked.canceled || !picked.result) return null;
  return picked.result.uri;
}

export interface Fix {
  lat: number;
  lng: number;
}

/**
 * Captures a GPS fix for a punch.
 *
 * Per the brief this is *informational only* — it is shown to the supervisor
 * during approval and never used to block a punch. A denied permission or a
 * failed fix therefore degrades to null instead of stopping the flow.
 */
export async function captureLocation(): Promise<Fix | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export type BiometricOutcome =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

/**
 * Device-level confirmation before a punch is written.
 *
 * This is deliberately NOT a face match against the stored face_scan_url —
 * the requirement is "your phone's fingerprint or passcode", i.e. proving the
 * handset owner is present. `disableDeviceFallback: false` lets the device
 * passcode stand in where no biometric is enrolled.
 */
export async function confirmWithBiometrics(prompt: string): Promise<BiometricOutcome> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !enrolled) {
    return { ok: false, reason: 'unavailable' };
  }

  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (res.success) return { ok: true };
  const err = 'error' in res ? res.error : '';
  if (err === 'user_cancel' || err === 'app_cancel' || err === 'system_cancel') {
    return { ok: false, reason: 'cancelled' };
  }
  return { ok: false, reason: 'failed' };
}

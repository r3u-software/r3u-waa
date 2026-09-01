import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useWorker } from '../../src/lib/session';
import { captureLocation, captureSelfie, confirmWithBiometrics, Fix } from '../../src/lib/capture';
import { uploadToBucket } from '../../src/lib/storage';
import { insertTimeEntry } from '../../src/lib/queries';
import { ScreenBody } from '../../src/components/Screen';
import { ErrorNote, PrimaryButton, SecondaryButton } from '../../src/components/ui';
import { CameraIcon, LockIcon, MapPinIcon } from '../../src/components/icons';
import { colors, fonts, radius, spacing, type } from '../../src/theme';
import { coords } from '../../src/lib/format';

/**
 * Time in / out.
 *
 * Order of operations matters here: the selfie and GPS are gathered first, but
 * NOTHING is written until device biometrics succeed. GPS is captured for the
 * supervisor's manual judgement and never blocks the punch (no geofence
 * enforcement — that's out of scope by design).
 */
export default function PunchScreen() {
  const worker = useWorker();
  const params = useLocalSearchParams<{ type: string; projectId: string; projectName: string }>();
  const punchType = params.type === 'out' ? 'out' : 'in';
  const projectId = params.projectId;
  const projectName = params.projectName ?? 'Site';

  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grab a GPS fix as soon as the screen opens so it's ready by submit time.
  useEffect(() => {
    let active = true;
    captureLocation().then((f) => {
      if (!active) return;
      setFix(f);
      setLocating(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function takeSelfie() {
    setError(null);
    const uri = await captureSelfie();
    if (uri) setSelfieUri(uri);
  }

  async function submit() {
    if (!selfieUri) {
      setError('Take a selfie first — it is what proves you were on site.');
      return;
    }
    if (!projectId) {
      setError('No site selected. Go back and pick the site you are working at.');
      return;
    }

    setError(null);

    // Gate: device biometric / passcode BEFORE anything is written.
    const auth = await confirmWithBiometrics(
      `Confirm time ${punchType} at ${projectName}`
    );
    if (!auth.ok) {
      if (auth.reason === 'unavailable') {
        setError(
          'This device has no fingerprint, Face ID, or passcode enrolled. Set one up in your phone settings — punches must be confirmed on-device.'
        );
      } else if (auth.reason === 'cancelled') {
        setError('Confirmation cancelled — your punch was not recorded.');
      } else {
        setError('Could not confirm it was you. Your punch was not recorded.');
      }
      return;
    }

    setSubmitting(true);
    try {
      const selfiePath = await uploadToBucket(
        'waa-selfies',
        worker.id,
        selfieUri,
        `punch-${punchType}`
      );

      await insertTimeEntry({
        worker_id: worker.id,
        project_id: projectId,
        type: punchType,
        selfie_url: selfiePath,
        gps_lat: fix?.lat ?? null,
        gps_lng: fix?.lng ?? null,
      });

      Alert.alert(
        `Time ${punchType} recorded`,
        'Your punch was sent to your supervisor and is waiting for review.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the punch. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenBody>
      <Text style={type.eyebrow}>{punchType === 'in' ? 'Clocking in' : 'Clocking out'}</Text>
      <Text style={[type.greet, { marginBottom: spacing.xl }]}>{projectName}</Text>

      {error ? <ErrorNote message={error} /> : null}

      {/* --------------------------------- Selfie ------------------------ */}
      <Text style={[type.label, { marginBottom: spacing.sm }]}>Selfie</Text>
      {selfieUri ? (
        <View style={s.previewWrap}>
          <Image source={{ uri: selfieUri }} style={s.preview} resizeMode="cover" />
          <SecondaryButton label="Retake selfie" onPress={takeSelfie} style={{ marginTop: 10 }} />
        </View>
      ) : (
        <Pressable style={s.capture} onPress={takeSelfie}>
          <CameraIcon size={26} color={colors.steel} />
          <Text style={s.captureText}>Take selfie</Text>
          <Text style={s.captureHint}>Front camera · you can retake before submitting</Text>
        </Pressable>
      )}

      {/* ----------------------------------- GPS ------------------------- */}
      <View style={s.gpsRow}>
        <MapPinIcon size={18} color={colors.steel} />
        <View style={{ flex: 1 }}>
          <Text style={s.gpsTitle}>
            {locating ? 'Getting your location…' : fix ? 'Location captured' : 'Location unavailable'}
          </Text>
          <Text style={s.gpsSub}>
            {locating
              ? 'Hold tight.'
              : fix
                ? coords(fix.lat, fix.lng)
                : 'Your punch will still go through — your supervisor will just see no coordinates.'}
          </Text>
        </View>
      </View>

      {/* ----------------------------- Biometric note -------------------- */}
      <View style={s.bioNote}>
        <LockIcon size={20} color={colors.steel} />
        <Text style={s.bioText}>
          Submitting asks for{' '}
          <Text style={s.bioStrong}>your phone's fingerprint, Face ID, or passcode</Text> before the
          punch is saved.
        </Text>
      </View>

      <PrimaryButton
        label={submitting ? 'Recording…' : `Confirm time ${punchType}`}
        onPress={submit}
        loading={submitting}
        disabled={!selfieUri}
      />
      <SecondaryButton
        label="Cancel"
        onPress={() => router.back()}
        style={{ marginTop: 10, marginBottom: 30 }}
      />
    </ScreenBody>
  );
}

const s = StyleSheet.create({
  capture: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.hero,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xl,
  },
  captureText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginTop: 4 },
  captureHint: { fontSize: 11.5, color: colors.muted, fontFamily: fonts.body },
  previewWrap: { marginBottom: spacing.xl },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: radius.hero,
    backgroundColor: colors.steel,
  },
  gpsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: spacing.md,
  },
  gpsTitle: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.ink },
  gpsSub: { fontSize: 11.5, color: colors.muted, marginTop: 2, lineHeight: 16, fontFamily: fonts.body },
  bioNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 13,
    marginBottom: spacing.xl,
  },
  bioText: { flex: 1, fontSize: 11.5, color: colors.muted, lineHeight: 17, fontFamily: fonts.body },
  bioStrong: { color: colors.ink, fontFamily: fonts.bodySemi },
});

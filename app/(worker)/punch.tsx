import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useWorker } from '../../src/lib/session';
import { captureLocation, captureSelfie, confirmWithBiometrics, Fix } from '../../src/lib/capture';
import { uploadToBucket } from '../../src/lib/storage';
import { insertTimeEntry } from '../../src/lib/queries';
import { CameraIcon, LockIcon, MapPinIcon } from '../../src/components/icons';
import { coords } from '../../src/lib/format';
import { useWebTheme } from '../../src/web/webTheme';
import { GlassButton, GlassErrorBanner, GlassOutlineButton, GlassScreen } from '../../src/web/webUi';

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
  const { palette } = useWebTheme();
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
        company_id: worker.company_id,
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
    <GlassScreen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 11, letterSpacing: 1, color: palette.muted, fontWeight: '700' }}>
          {punchType === 'in' ? 'Clocking in' : 'Clocking out'}
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginTop: 3, marginBottom: 20 }}>
          {projectName}
        </Text>

        {error ? <GlassErrorBanner message={error} /> : null}

        {/* --------------------------------- Selfie ------------------------ */}
        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          Selfie
        </Text>
        {selfieUri ? (
          <View style={{ marginBottom: 20 }}>
            <Image source={{ uri: selfieUri }} style={[s.preview, { backgroundColor: palette.panelSolid }]} resizeMode="cover" />
            <GlassOutlineButton label="Retake selfie" onPress={takeSelfie} style={{ marginTop: 10 }} />
          </View>
        ) : (
          <Pressable
            style={[s.capture, { backgroundColor: palette.panel, borderColor: palette.border }]}
            onPress={takeSelfie}
          >
            <CameraIcon size={26} color={palette.muted} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginTop: 4 }}>Take selfie</Text>
            <Text style={{ fontSize: 11.5, color: palette.muted }}>Front camera · you can retake before submitting</Text>
          </Pressable>
        )}

        {/* ----------------------------------- GPS ------------------------- */}
        <View style={[s.row, { backgroundColor: palette.panel, borderColor: palette.border, marginBottom: 12 }]}>
          <MapPinIcon size={18} color={palette.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
              {locating ? 'Getting your location…' : fix ? 'Location captured' : 'Location unavailable'}
            </Text>
            <Text style={{ fontSize: 11.5, color: palette.muted, marginTop: 2, lineHeight: 16 }}>
              {locating
                ? 'Hold tight.'
                : fix
                  ? coords(fix.lat, fix.lng)
                  : 'Your punch will still go through — your supervisor will just see no coordinates.'}
            </Text>
          </View>
        </View>

        {/* ----------------------------- Biometric note -------------------- */}
        <View style={[s.row, { backgroundColor: palette.panel, borderColor: palette.border, marginBottom: 20 }]}>
          <LockIcon size={20} color={palette.muted} />
          <Text style={{ flex: 1, fontSize: 11.5, color: palette.muted, lineHeight: 17 }}>
            Submitting asks for{' '}
            <Text style={{ color: palette.text, fontWeight: '700' }}>your phone's fingerprint, Face ID, or passcode</Text> before the
            punch is saved.
          </Text>
        </View>

        <GlassButton
          label={submitting ? 'Recording…' : `Confirm time ${punchType}`}
          onPress={submit}
          loading={submitting}
          disabled={!selfieUri}
        />
        <GlassOutlineButton label="Cancel" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </ScrollView>
    </GlassScreen>
  );
}

const s = StyleSheet.create({
  capture: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingVertical: 36,
    alignItems: 'center',
    marginBottom: 20,
  },
  preview: { width: '100%', height: 300, borderRadius: 20 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14 },
});

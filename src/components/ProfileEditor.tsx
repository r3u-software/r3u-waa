import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../lib/session';
import { updateWorkerProfile } from '../lib/queries';
import { captureDocument, captureSelfie, pickImageFromLibrary } from '../lib/capture';
import { uploadToBucket } from '../lib/storage';
import type { WaaWorker } from '../lib/types';
import { SignedImage } from './SignedImage';
import { CameraIcon, FileIcon, IdCardIcon } from './icons';
import { toneForStatus } from '../theme';
import { useWebTheme } from '../web/webTheme';
import { GlassButton, GlassCard, GlassErrorBanner, GlassField, webToneFor, WebPill } from '../web/webUi';

/**
 * Shared by the onboarding screen and the Profile tab — the same controls,
 * just introduced differently. The worker may correct the name/phone their
 * supervisor entered, and supplies their own face scan + valid ID.
 *
 * The contract PDF is deliberately view-only here: contracts are uploaded by
 * supervisors, and the brief is explicit that workers get no reupload control.
 */
export function ProfileEditor({ worker, onboarding }: { worker: WaaWorker; onboarding?: boolean }) {
  const { refreshProfile } = useSession();
  const { palette } = useWebTheme();
  const [fullName, setFullName] = useState(worker.full_name);
  const [phone, setPhone] = useState(worker.phone ?? '');
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploading, setUploading] = useState<'face' | 'id' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasFace = Boolean(worker.face_scan_url);
  const hasId = Boolean(worker.valid_id_url);
  const complete = hasFace && hasId;

  async function saveDetails() {
    if (!fullName.trim()) {
      setError('Your name cannot be blank.');
      return;
    }
    setError(null);
    setSavingDetails(true);
    try {
      await updateWorkerProfile(
        worker.id,
        { full_name: fullName.trim(), phone: phone.trim() || null },
        worker
      );
      await refreshProfile();
      Alert.alert('Saved', 'Your details were updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your details.');
    } finally {
      setSavingDetails(false);
    }
  }

  async function doFaceScan() {
    const uri = await captureSelfie();
    if (!uri) return;
    setUploading('face');
    setError(null);
    try {
      const path = await uploadToBucket('waa-selfies', worker.id, uri, 'face-scan');
      await updateWorkerProfile(worker.id, { face_scan_url: path }, worker);
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload your face scan.');
    } finally {
      setUploading(null);
    }
  }

  function chooseIdSource() {
    Alert.alert('Valid ID', 'How do you want to add it?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => doIdUpload('camera') },
      { text: 'Choose from photos', onPress: () => doIdUpload('library') },
    ]);
  }

  async function doIdUpload(source: 'camera' | 'library') {
    const uri = source === 'camera' ? await captureDocument() : await pickImageFromLibrary();
    if (!uri) return;
    setUploading('id');
    setError(null);
    try {
      const path = await uploadToBucket('waa-ids', worker.id, uri, 'valid-id');
      await updateWorkerProfile(worker.id, { valid_id_url: path }, worker);
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload your ID.');
    } finally {
      setUploading(null);
    }
  }

  return (
    <>
      {error ? <GlassErrorBanner message={error} /> : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Registration status</Text>
        <WebPill label={worker.status} tone={webToneFor(toneForStatus(worker.status))} />
      </View>
      <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17, marginBottom: 20 }}>
        {complete
          ? 'Your profile is complete. Your supervisor can now verify your punches.'
          : 'Add both a face scan and a valid ID to complete your registration.'}
      </Text>

      {/* -------------------------------- Face scan --------------------- */}
      <SectionTitle>Face scan</SectionTitle>
      <GlassCard style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          {hasFace ? (
            <SignedImage bucket="waa-selfies" path={worker.face_scan_url} size={72} radius={12} />
          ) : (
            <View style={[st.mediaPlaceholder, { backgroundColor: palette.hover, borderColor: palette.border }]}>
              <CameraIcon size={22} color={palette.muted} />
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>{hasFace ? 'Face scan on file' : 'No face scan yet'}</Text>
            <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17 }}>
              A clear selfie taken with the front camera. You can retake it any time.
            </Text>
          </View>
        </View>
        <GlassButton
          label={uploading === 'face' ? 'Uploading…' : hasFace ? 'Retake face scan' : 'Take face scan'}
          onPress={doFaceScan}
          loading={uploading === 'face'}
          style={{ marginTop: 12 }}
        />
      </GlassCard>

      {/* -------------------------------- Valid ID ---------------------- */}
      <SectionTitle>Valid ID</SectionTitle>
      <GlassCard style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          {hasId ? (
            <SignedImage bucket="waa-ids" path={worker.valid_id_url} size={72} radius={12} />
          ) : (
            <View style={[st.mediaPlaceholder, { backgroundColor: palette.hover, borderColor: palette.border }]}>
              <IdCardIcon size={22} color={palette.muted} />
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>{hasId ? 'Valid ID on file' : 'No valid ID yet'}</Text>
            <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17 }}>
              Any government-issued ID. Make sure the name and photo are readable.
            </Text>
          </View>
        </View>
        <GlassButton
          label={uploading === 'id' ? 'Uploading…' : hasId ? 'Replace valid ID' : 'Upload valid ID'}
          onPress={chooseIdSource}
          loading={uploading === 'id'}
          style={{ marginTop: 12 }}
        />
      </GlassCard>

      {/* -------------------------------- Details ----------------------- */}
      <SectionTitle>Your details</SectionTitle>
      <GlassCard style={{ marginBottom: 20 }}>
        <GlassField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" hint="Correct this if your supervisor typed it wrong." />
        <GlassField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="09XX XXX XXXX"
          keyboardType="phone-pad"
          hint="Changing this does not change the number you log in with."
        />
        <GlassButton label={savingDetails ? 'Saving…' : 'Save details'} onPress={saveDetails} loading={savingDetails} />
      </GlassCard>

      {/* -------------------------------- Contract ---------------------- */}
      <SectionTitle>Contract</SectionTitle>
      <GlassCard onPress={worker.contract_pdf_url ? () => router.push('/(worker)/contract') : undefined} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={[st.mediaPlaceholder, { backgroundColor: palette.hover, borderColor: palette.border }]}>
            <FileIcon size={22} color={worker.contract_pdf_url ? palette.text : palette.muted} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
              {worker.contract_pdf_url ? 'Signed contract available' : 'No contract uploaded yet'}
            </Text>
            <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 17 }}>
              {worker.contract_pdf_url ? 'Tap to read your contract. View only.' : 'Your supervisor uploads this once your contract is signed.'}
            </Text>
          </View>
        </View>
      </GlassCard>

      {onboarding && complete ? (
        <GlassButton label="Go to my dashboard" onPress={() => router.replace('/(worker)/(tabs)')} style={{ marginBottom: 30 }} />
      ) : null}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { palette } = useWebTheme();
  return <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>{children}</Text>;
}

const st = {
  mediaPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};

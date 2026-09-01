import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../lib/session';
import { updateWorkerProfile } from '../lib/queries';
import { captureDocument, captureSelfie, pickImageFromLibrary } from '../lib/capture';
import { uploadToBucket } from '../lib/storage';
import type { WaaWorker } from '../lib/types';
import { SignedImage } from './SignedImage';
import { Card, ErrorNote, Field, Pill, PrimaryButton, Section } from './ui';
import { CameraIcon, FileIcon, IdCardIcon } from './icons';
import { colors, fonts, radius, spacing, toneForStatus, type } from '../theme';

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
      {error ? <ErrorNote message={error} /> : null}

      <View style={s.statusRow}>
        <Text style={type.sectionTitle}>Registration status</Text>
        <Pill label={worker.status} tone={toneForStatus(worker.status)} />
      </View>
      <Text style={s.statusHint}>
        {complete
          ? 'Your profile is complete. Your supervisor can now verify your punches.'
          : 'Add both a face scan and a valid ID to complete your registration.'}
      </Text>

      {/* -------------------------------- Face scan --------------------- */}
      <Section title="Face scan">
        <Card>
          <View style={s.mediaRow}>
            {hasFace ? (
              <SignedImage bucket="waa-selfies" path={worker.face_scan_url} size={72} radius={12} />
            ) : (
              <View style={s.mediaPlaceholder}>
                <CameraIcon size={22} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={type.cardTitle}>{hasFace ? 'Face scan on file' : 'No face scan yet'}</Text>
              <Text style={type.cardSub}>
                A clear selfie taken with the front camera. You can retake it any time.
              </Text>
            </View>
          </View>
          <PrimaryButton
            label={uploading === 'face' ? 'Uploading…' : hasFace ? 'Retake face scan' : 'Take face scan'}
            onPress={doFaceScan}
            loading={uploading === 'face'}
            tone={hasFace ? 'ink' : 'safety'}
            style={{ marginTop: 12 }}
          />
        </Card>
      </Section>

      {/* -------------------------------- Valid ID ---------------------- */}
      <Section title="Valid ID">
        <Card>
          <View style={s.mediaRow}>
            {hasId ? (
              <SignedImage bucket="waa-ids" path={worker.valid_id_url} size={72} radius={12} />
            ) : (
              <View style={s.mediaPlaceholder}>
                <IdCardIcon size={22} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={type.cardTitle}>{hasId ? 'Valid ID on file' : 'No valid ID yet'}</Text>
              <Text style={type.cardSub}>
                Any government-issued ID. Make sure the name and photo are readable.
              </Text>
            </View>
          </View>
          <PrimaryButton
            label={uploading === 'id' ? 'Uploading…' : hasId ? 'Replace valid ID' : 'Upload valid ID'}
            onPress={chooseIdSource}
            loading={uploading === 'id'}
            tone={hasId ? 'ink' : 'safety'}
            style={{ marginTop: 12 }}
          />
        </Card>
      </Section>

      {/* -------------------------------- Details ----------------------- */}
      <Section title="Your details">
        <Card style={{ padding: spacing.xl }}>
          <Field
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            hint="Correct this if your supervisor typed it wrong."
          />
          <Field
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="09XX XXX XXXX"
            keyboardType="phone-pad"
            hint="Changing this does not change the number you log in with."
          />
          <PrimaryButton
            label={savingDetails ? 'Saving…' : 'Save details'}
            onPress={saveDetails}
            loading={savingDetails}
            tone="ink"
          />
        </Card>
      </Section>

      {/* -------------------------------- Contract ---------------------- */}
      <Section title="Contract">
        <Card onPress={worker.contract_pdf_url ? () => router.push('/(worker)/contract') : undefined}>
          <View style={s.mediaRow}>
            <View style={s.mediaPlaceholder}>
              <FileIcon size={22} color={worker.contract_pdf_url ? colors.steel : colors.muted} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={type.cardTitle}>
                {worker.contract_pdf_url ? 'Signed contract available' : 'No contract uploaded yet'}
              </Text>
              <Text style={type.cardSub}>
                {worker.contract_pdf_url
                  ? 'Tap to read your contract. View only.'
                  : 'Your supervisor uploads this once your contract is signed.'}
              </Text>
            </View>
          </View>
        </Card>
      </Section>

      {onboarding && complete ? (
        <PrimaryButton
          label="Go to my dashboard"
          onPress={() => router.replace('/(worker)/(tabs)')}
          style={{ marginBottom: 30 }}
        />
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusHint: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginBottom: spacing.xl,
    fontFamily: fonts.body,
  },
  mediaRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  mediaPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

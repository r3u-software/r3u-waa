import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, useWorker } from '../../../src/lib/session';
import { ProfileEditor } from '../../../src/components/ProfileEditor';
import { initialsOf } from '../../../src/lib/format';
import { useWebTheme } from '../../../src/web/webTheme';
import { ColorThemeSwitcher, GlassCard, GlassOutlineButton, GlassScreen, WebSection } from '../../../src/web/webUi';
import { SignedImage } from '../../../src/components/SignedImage';
import { LinearGradient } from 'expo-linear-gradient';

export default function WorkerProfile() {
  const worker = useWorker();
  const { signOut } = useSession();
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();

  function confirmSignOut() {
    Alert.alert(
      'Sign out?',
      'You will need your User ID and password to get back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: signOut },
      ]
    );
  }

  return (
    <GlassScreen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 26 }}>
          {/* Once a supervisor has approved the face scan, it stands in for
              the gradient-initials mark — a real photo confirms this is the
              actual verified person, not just whoever typed the password. */}
          {worker.status === 'complete' && worker.face_scan_url ? (
            <SignedImage bucket="waa-selfies" path={worker.face_scan_url} size={58} radius={16} />
          ) : (
            <LinearGradient
              colors={[palette.accent, palette.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 19 }}>{initialsOf(worker.full_name || '?')}</Text>
            </LinearGradient>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{worker.full_name}</Text>
            <Text style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>{worker.phone || 'No phone on file'}</Text>
            <Text style={{ fontSize: 11, color: palette.accent2, marginTop: 3, fontWeight: '700' }}>
              User ID: {worker.login_code}
            </Text>
          </View>
        </View>

        <ProfileEditor worker={worker} />

        <WebSection title="Appearance">
          <GlassCard>
            <ColorThemeSwitcher />
          </GlassCard>
        </WebSection>

        <GlassOutlineButton label="Sign out" onPress={confirmSignOut} style={{ marginBottom: 30 }} />
      </ScrollView>
    </GlassScreen>
  );
}

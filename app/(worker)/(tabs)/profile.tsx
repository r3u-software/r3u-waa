import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, useWorker } from '../../../src/lib/session';
import { ProfileEditor } from '../../../src/components/ProfileEditor';
import { initialsOf } from '../../../src/lib/format';
import { useWebTheme } from '../../../src/web/webTheme';
import { GlassOutlineButton, GlassScreen } from '../../../src/web/webUi';
import { LinearGradient } from 'expo-linear-gradient';

export default function WorkerProfile() {
  const worker = useWorker();
  const { signOut, session } = useSession();
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need your phone number and password to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <GlassScreen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 26 }}>
          <LinearGradient
            colors={[palette.accent, palette.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 19 }}>{initialsOf(worker.full_name)}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{worker.full_name}</Text>
            <Text style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>{worker.phone || 'No phone on file'}</Text>
            <Text style={{ fontSize: 11, color: palette.muted, marginTop: 3 }}>{session?.user.email}</Text>
          </View>
        </View>

        <ProfileEditor worker={worker} />

        <GlassOutlineButton label="Sign out" onPress={confirmSignOut} style={{ marginBottom: 30 }} />
      </ScrollView>
    </GlassScreen>
  );
}

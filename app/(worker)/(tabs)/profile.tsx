import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSession, useWorker } from '../../../src/lib/session';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import { ProfileEditor } from '../../../src/components/ProfileEditor';
import { SecondaryButton } from '../../../src/components/ui';
import { colors, fonts, radius, spacing, type } from '../../../src/theme';
import { initialsOf } from '../../../src/lib/format';

export default function WorkerProfile() {
  const worker = useWorker();
  const { signOut, session } = useSession();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need your phone number and password to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Profile" />
      <ScreenBody>
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initialsOf(worker.full_name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.greet}>{worker.full_name}</Text>
            <Text style={type.subgreet}>{worker.phone || 'No phone on file'}</Text>
            <Text style={s.loginHint}>{session?.user.email}</Text>
          </View>
        </View>

        <ProfileEditor worker={worker} />

        <SecondaryButton label="Sign out" onPress={confirmSignOut} style={{ marginBottom: 30 }} />
      </ScreenBody>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: spacing.xxl },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 19 },
  loginHint: { fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
});

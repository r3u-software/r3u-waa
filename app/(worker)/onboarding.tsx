import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorker } from '../../src/lib/session';
import { ProfileEditor } from '../../src/components/ProfileEditor';
import { useWebTheme } from '../../src/web/webTheme';
import { GlassScreen } from '../../src/web/webUi';

/**
 * Profile completion. Same controls as the Profile tab, framed as a checklist
 * for a worker who just logged in with supervisor-issued temp credentials.
 */
export default function OnboardingScreen() {
  const worker = useWorker();
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();

  return (
    <GlassScreen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 11, letterSpacing: 1, color: palette.accent2, fontWeight: '700' }}>STEP 1 OF 1</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginTop: 4 }}>
          Welcome, {worker.full_name.split(' ')[0]}
        </Text>
        <Text style={{ fontSize: 13, color: palette.muted, marginTop: 4, marginBottom: 20 }}>
          Two things and you're set up: a face scan and a valid ID.
        </Text>
        <ProfileEditor worker={worker} onboarding />
      </ScrollView>
    </GlassScreen>
  );
}

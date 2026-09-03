import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession, useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import { fetchProjects, fetchRoster } from '../../../src/lib/queries';
import { supabase } from '../../../src/lib/supabase';
import type { WaaAssignmentWithProject } from '../../../src/lib/types';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import { Card, Loader, Section, SecondaryButton, StatusStrip } from '../../../src/components/ui';
import { colors, fonts, radius, spacing, type } from '../../../src/theme';
import { initialsOf } from '../../../src/lib/format';
import { ColorThemeSwitcher, ModeSwitcher } from '../../../src/web/webUi';

/** The supervisor's own info — read-only, plus sign-out. */
export default function SupervisorProfile() {
  const supervisor = useSupervisor();
  const { signOut } = useSession();

  const { data, loading } = useAsync(async () => {
    const [roster, projects] = await Promise.all([fetchRoster(), fetchProjects()]);

    const workerIds = roster.map((w) => w.id);
    let assignments: WaaAssignmentWithProject[] = [];
    if (workerIds.length > 0) {
      const { data: rows } = await supabase
        .from('waa_worker_project_assignments')
        .select('*, project:waa_projects(*)')
        .in('worker_id', workerIds);
      assignments = (rows as WaaAssignmentWithProject[]) ?? [];
    }
    return { roster, projects, assignments };
  }, [supervisor.id]);

  /** The distinct sites this supervisor's workers actually cover. */
  const mySites = useMemo(() => {
    const names = new Map<string, string>();
    for (const a of data?.assignments ?? []) {
      if (a.project) names.set(a.project.id, a.project.name);
    }
    return Array.from(names.values());
  }, [data?.assignments]);

  const incomplete = (data?.roster ?? []).filter((w) => w.status !== 'complete').length;

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need your User ID and password to get back in.', [
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
            <Text style={s.avatarText}>{initialsOf(supervisor.full_name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.greet}>{supervisor.full_name}</Text>
            <Text style={type.subgreet}>Supervisor</Text>
            <Text style={s.email}>User ID: {supervisor.login_code}</Text>
          </View>
        </View>

        {loading && !data ? (
          <Loader />
        ) : (
          <StatusStrip
            chips={[
              { value: data?.roster.length ?? 0, label: 'Workers', tone: 'ok' },
              { value: mySites.length, label: 'Sites covered', tone: 'pending' },
              { value: incomplete, label: 'Incomplete profiles', tone: 'warn' },
            ]}
          />
        )}

        <Section title="Your details">
          <Card style={{ gap: 14 }}>
            <Detail label="Full name" value={supervisor.full_name} />
            <Detail label="Phone" value={supervisor.phone || 'Not set'} />
            <Detail label="User ID" value={supervisor.login_code} />
            <Detail
              label="Sites covered"
              value={mySites.length > 0 ? mySites.join(', ') : 'No assignments yet'}
            />
          </Card>
          <Text style={s.note}>
            Supervisor accounts are provisioned by R3U. Contact the office to change these details.
          </Text>
        </Section>

        <Section title="Appearance">
          <Card style={{ gap: 14 }}>
            <View>
              <Text style={type.label}>Mode</Text>
              <View style={{ marginTop: 8 }}>
                <ModeSwitcher />
              </View>
            </View>
            <View>
              <Text style={type.label}>Color theme</Text>
              <View style={{ marginTop: 8 }}>
                <ColorThemeSwitcher />
              </View>
            </View>
          </Card>
        </Section>

        <Section title="Shortcuts">
          <SecondaryButton
            label="Register a worker"
            onPress={() => router.push('/(supervisor)/register-worker')}
            style={{ marginBottom: 10 }}
          />
          <SecondaryButton
            label="Notifications"
            onPress={() => router.push('/(supervisor)/notifications')}
          />
        </Section>

        <SecondaryButton label="Sign out" onPress={confirmSignOut} style={{ marginBottom: 30 }} />
      </ScreenBody>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={type.label}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
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
  email: { fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
  detailValue: { fontSize: 14, color: colors.ink, marginTop: 3, fontFamily: fonts.bodySemi },
  note: {
    fontSize: 11.5,
    color: colors.muted,
    lineHeight: 17,
    marginTop: 4,
    fontFamily: fonts.body,
  },
});

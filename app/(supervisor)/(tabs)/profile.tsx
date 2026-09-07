import React, { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import { fetchProjects, fetchRoster } from '../../../src/lib/queries';
import { supabase } from '../../../src/lib/supabase';
import type { WaaAssignmentWithProject } from '../../../src/lib/types';
import { initialsOf } from '../../../src/lib/format';
import { useWebTheme } from '../../../src/web/webTheme';
import {
  ColorThemeSwitcher,
  GlassCard,
  GlassOutlineButton,
  GlassScreen,
  WebSection,
} from '../../../src/web/webUi';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * The supervisor's own info — read-only, plus sign-out.
 *
 * Reskinned to the glass system (2026-09-04) — this was the one screen the
 * "Supervisor's own screens" pass explicitly left out, only bolting glass
 * sub-components (Appearance's `ColorThemeSwitcher`, and briefly a
 * biometric toggle) onto an otherwise still-paper `Card`/`Section`
 * shell underneath. All fetch logic (roster, projects, assignments,
 * incomplete-profile count) is unchanged — view layer only, same as every
 * other screen in this app's reskin history.
 */
export default function SupervisorProfile() {
  const supervisor = useSupervisor();
  const { signOut } = useSession();
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();

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
          <LinearGradient
            colors={[palette.accent, palette.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 19 }}>{initialsOf(supervisor.full_name)}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{supervisor.full_name}</Text>
            <Text style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>Supervisor</Text>
            <Text style={{ fontSize: 11, color: palette.accent2, marginTop: 3, fontWeight: '700' }}>
              User ID: {supervisor.login_code}
            </Text>
          </View>
        </View>

        {!loading || data ? (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
            <MetricChip value={data?.roster.length ?? 0} label="Workers" />
            <MetricChip value={mySites.length} label="Sites covered" />
            <MetricChip value={incomplete} label="Incomplete profiles" tone={incomplete > 0 ? 'warn' : undefined} />
          </View>
        ) : null}

        <WebSection title="Your details">
          <GlassCard style={{ gap: 14 }}>
            <Detail label="Full name" value={supervisor.full_name} />
            <Detail label="Phone" value={supervisor.phone || 'Not set'} />
            <Detail label="User ID" value={supervisor.login_code} />
            <Detail
              label="Sites covered"
              value={mySites.length > 0 ? mySites.join(', ') : 'No assignments yet'}
            />
          </GlassCard>
          <Text style={{ fontSize: 11.5, color: palette.muted, lineHeight: 17, marginTop: 8 }}>
            Supervisor accounts are provisioned by R3U. Contact the office to change these details.
          </Text>
        </WebSection>

        <WebSection title="Appearance">
          <GlassCard>
            <ColorThemeSwitcher />
          </GlassCard>
        </WebSection>

        <WebSection title="Shortcuts">
          <GlassOutlineButton
            label="Register a worker"
            onPress={() => router.push('/(supervisor)/register-worker')}
            style={{ marginBottom: 10 }}
          />
          <GlassOutlineButton
            label="Notifications"
            onPress={() => router.push('/(supervisor)/notifications')}
          />
        </WebSection>

        <GlassOutlineButton label="Sign out" onPress={confirmSignOut} style={{ marginBottom: 30 }} />
      </ScrollView>
    </GlassScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { palette } = useWebTheme();
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: palette.text, marginTop: 3, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

function MetricChip({ value, label, tone }: { value: number; label: string; tone?: 'warn' }) {
  const { palette } = useWebTheme();
  return (
    <GlassCard style={{ flex: 1, paddingVertical: 14, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: tone === 'warn' && value > 0 ? palette.bad : palette.text }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10.5, color: palette.muted, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </GlassCard>
  );
}

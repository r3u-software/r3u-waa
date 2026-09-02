import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Slot, useRouter, useSegments } from 'expo-router';
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { SessionProvider, useSession } from '../src/lib/session';
import { colors, fonts } from '../src/theme';

/**
 * Auth + role guard.
 *
 * Route groups: `(worker)`, `(supervisor)`, `(hr)` and `(platform-owner)`. A
 * signed-out user is pushed to /login; a signed-in user is pushed into the
 * group matching the table their auth_user_id was found in.
 *
 * Two gates sit in front of those four redirects, in this order:
 *
 *   1. `must_change_password = true` holds the account on /change-password.
 *      Platform Owner never trips this — `waa_platform_owners` has no such
 *      column, and `mustChangePassword` is derived only from the three
 *      company-scoped role rows, so it stays false rather than being read off
 *      a field that doesn't exist.
 *   2. HR/Admin only: `profile_complete = false` then holds it on
 *      /complete-profile. Worker and Supervisor have their own, separate
 *      onboarding inside their own groups and are untouched by this step.
 *
 * Both checks run before the per-role redirects below, so a deep link, a back
 * gesture or a hand-typed /(hr) URL all land back on the screen that is still
 * owed — there is no route into a role group while either gate is open.
 */
function RootNavigator() {
  const { loading, session, role, roleError, mustChangePassword, hrProfileIncomplete } =
    useSession();
  const segments = useSegments();
  const router = useRouter();

  const group = segments[0];
  const inWorker = group === '(worker)';
  const inSupervisor = group === '(supervisor)';
  const inHr = group === '(hr)';
  const inPlatformOwner = group === '(platform-owner)';
  const onLogin = group === 'login';
  const onChangePassword = group === 'change-password';
  const onCompleteProfile = group === 'complete-profile';

  /** Signed in, role resolved, and the temp password hasn't been rotated yet. */
  const mustReset = !!session && !!role && mustChangePassword;
  /** Password already rotated, but this HR/Admin still owes their profile. */
  const mustCompleteProfile =
    !mustReset && !!session && role === 'hr_admin' && hrProfileIncomplete;
  /** Neither gate is open — the per-role redirects may run. */
  const clear = !mustReset && !mustCompleteProfile;

  // Mirrors the effect's redirect decision below, but computed synchronously
  // during render. Session/role changes (e.g. sign-out) update context state
  // immediately, which re-renders whatever screen is still mounted on the
  // *old* route before the effect below has a chance to navigate away from
  // it — and that screen's useWorker()/useSupervisor() throws because the
  // role it expects is already gone. Holding on the splash screen for that
  // one transitional frame (instead of letting <Slot /> render the
  // now-mismatched route) avoids the crash entirely.
  const needsRedirect =
    !loading &&
    ((!session && !onLogin) ||
      (!!session && !role && !onLogin) ||
      (mustReset && !onChangePassword) ||
      (mustCompleteProfile && !onCompleteProfile) ||
      (clear && role === 'worker' && !inWorker) ||
      (clear && role === 'supervisor' && !inSupervisor) ||
      (clear && role === 'hr_admin' && !inHr) ||
      (clear && role === 'platform_owner' && !inPlatformOwner));

  useEffect(() => {
    if (loading) return;

    if (!session) {
      if (!onLogin) router.replace('/login');
      return;
    }

    // Signed in but neither table matched — hold on the login screen, which
    // renders the explanation from `roleError`.
    if (!role) {
      if (!onLogin) router.replace('/login');
      return;
    }

    // Ahead of every role redirect: the temp password has to be rotated first.
    // Once /change-password calls refreshProfile(), `mustChangePassword` flips
    // false here and the role redirect below takes over on the next render.
    if (mustReset) {
      if (!onChangePassword) router.replace('/change-password');
      return;
    }

    // Then, for HR/Admin only: the generated account arrives with no name,
    // email or phone on it. Same treatment as the reset above — held here
    // until /complete-profile writes the row and calls refreshProfile().
    if (mustCompleteProfile) {
      if (!onCompleteProfile) router.replace('/complete-profile');
      return;
    }

    if (role === 'worker' && !inWorker) {
      router.replace('/(worker)');
    } else if (role === 'supervisor' && !inSupervisor) {
      router.replace('/(supervisor)');
    } else if (role === 'hr_admin' && !inHr) {
      // HR-ANALYTICS-ADDENDUM.md / WEB-DEPLOYMENT-ADDENDUM.md: the mobile tab
      // shell ((tabs)/index.tsx) stays HR/Admin's landing screen on Android --
      // that part of HR-ADMIN-MOBILE-ACCESS-ADDENDUM.md isn't superseded by
      // this change. On web, land on the one real full-dashboard screen that
      // exists so far (analytics) instead. This is the only platform branch
      // in this file; the rest of HR/Admin's web dashboard (grid, roster,
      // settings) and any native-side lockout are a separate, not-yet-built
      // phase -- deliberately not touched here.
      router.replace(Platform.OS === 'web' ? '/(hr)/analytics' : '/(hr)');
    } else if (role === 'platform_owner' && !inPlatformOwner) {
      router.replace('/(platform-owner)');
    }
  }, [
    loading,
    session,
    role,
    roleError,
    mustReset,
    mustCompleteProfile,
    group,
    inWorker,
    inSupervisor,
    inHr,
    inPlatformOwner,
    onLogin,
    onChangePassword,
    onCompleteProfile,
    router,
  ]);

  if (loading || needsRedirect) {
    return (
      <View style={s.splash}>
        <Text style={s.splashBrand}>R3U</Text>
        <Text style={s.splashName}>Worker's Attendance</Text>
        <ActivityIndicator color={colors.safety} style={{ marginTop: 18 }} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={s.splash}>
        <Text style={s.splashBrand}>R3U</Text>
        <ActivityIndicator color={colors.safety} style={{ marginTop: 18 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashBrand: {
    fontFamily: fonts.serif,
    fontSize: 40,
    fontWeight: '700',
    color: colors.safety,
    letterSpacing: 1,
  },
  splashName: {
    fontFamily: fonts.serif,
    fontSize: 17,
    color: colors.paper,
    marginTop: 4,
  },
});

import React from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../src/lib/session';
import { colors, fonts, radius, spacing } from '../src/theme';
import { ErrorNote, PrimaryButton, SecondaryButton } from '../src/components/ui';
import { SiteIcon } from '../src/components/icons';

/**
 * HR-DASHBOARD-RELOCATION-PROPOSAL.md, Stage D — the native lockout screen
 * for HR/Admin and Platform Owner, per HR-ADMIN-WEB-ONLY-ADDENDUM.md ("same
 * treatment as Platform Owner: block with a 'use the web dashboard'
 * message"). Neither role has any native screen of their own left to route
 * to once this ships — both work entirely through the web dashboard now.
 *
 * WEB_DASHBOARD_URL is now the real, live GitHub Pages deployment —
 * verified in a real browser end-to-end (real login, real data, nav to
 * every screen) before this placeholder was replaced. The root guard in
 * app/_layout.tsx now does route both roles here on native.
 */
const WEB_DASHBOARD_URL = 'https://r3u-software.github.io/r3u-waa/';

export default function BlockedUseWeb() {
  const insets = useSafeAreaInsets();
  const { role, signOut } = useSession();

  const roleLabel = role === 'platform_owner' ? 'Platform Owner' : 'HR/Admin';

  async function openDashboard() {
    const can = await Linking.canOpenURL(WEB_DASHBOARD_URL);
    if (!can) {
      Alert.alert('Could not open the dashboard', `Open this address in a browser instead:\n\n${WEB_DASHBOARD_URL}`);
      return;
    }
    await Linking.openURL(WEB_DASHBOARD_URL);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 48 }]}>
      <View style={s.brandMark}>
        <SiteIcon size={26} color={colors.safety} />
      </View>
      <Text style={s.co}>R3U Site Suite</Text>
      <Text style={s.title}>Use the web dashboard</Text>
      <Text style={s.tagline}>{roleLabel} works entirely on the web now — there is nothing for this account to do here.</Text>

      <View style={s.card}>
        <ErrorNote message="This account no longer has a screen in the mobile app. Open the web dashboard on a desktop or laptop browser to continue." />

        <Text style={s.urlLabel}>WEB DASHBOARD</Text>
        <Text style={s.url} selectable>
          {WEB_DASHBOARD_URL}
        </Text>

        <PrimaryButton label="Open the dashboard" onPress={openDashboard} style={{ marginTop: spacing.lg }} />
        <SecondaryButton label="Sign out" onPress={signOut} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, alignItems: 'stretch', padding: spacing.xl },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  co: {
    fontSize: 10.5,
    letterSpacing: 1.3,
    color: colors.muted,
    fontFamily: fonts.bodyBold,
    textAlign: 'center',
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 2,
  },
  tagline: {
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: spacing.xxl,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.hero,
    padding: spacing.xl,
  },
  urlLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    fontFamily: fonts.bodyBold,
    marginTop: spacing.lg,
    marginBottom: 4,
  },
  url: { fontSize: 13, color: colors.ink, fontFamily: fonts.bodySemi },
});

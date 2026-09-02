import React from 'react';
import { Alert, Linking } from 'react-native';
import { useSession } from '../src/lib/session';
import { WebThemeProvider } from '../src/web/webTheme';
import { AuthShell, GlassButton, GlassCallout, GlassErrorBanner, GlassOutlineButton } from '../src/web/webUi';

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
 *
 * Same `AuthShell` glass chrome as login.tsx — R3U-WAA-WEB-REDESIGN.md's
 * follow-up. This is the very first screen HR/Admin or Platform Owner see
 * on native after signing in through the (now also glass) login screen, so
 * leaving it in the old paper theme would have been the most visible seam
 * of all.
 */
const WEB_DASHBOARD_URL = 'https://r3u-software.github.io/r3u-waa/';

export default function BlockedUseWeb() {
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
    <WebThemeProvider>
      <AuthShell
        eyebrow="R3U SITE SUITE"
        title="Use the web dashboard"
        tagline={`${roleLabel} works entirely on the web now — there is nothing for this account to do here.`}
      >
        <GlassErrorBanner message="This account no longer has a screen in the mobile app. Open the web dashboard on a desktop or laptop browser to continue." />

        <GlassCallout label="WEB DASHBOARD" value={WEB_DASHBOARD_URL} />

        <GlassButton label="Open the dashboard" onPress={openDashboard} />
        <GlassOutlineButton label="Sign out" onPress={signOut} style={{ marginTop: 10 }} />
      </AuthShell>
    </WebThemeProvider>
  );
}

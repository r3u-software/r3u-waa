import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useHrAdmin, useSession } from '../../../src/lib/session';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import { Card, SecondaryButton, Section } from '../../../src/components/ui';
import { ChevronRightIcon, SiteGlyph } from '../../../src/components/icons';
import { colors, fonts, radius, spacing, type } from '../../../src/theme';
import { initialsOf } from '../../../src/lib/format';

/**
 * The HR/Admin's own info — read-only, plus sign-out.
 *
 * The org-wide counters that used to sit here (active workers, sites, open
 * runs) are gone: they came from `waa_workers` / `waa_payroll_runs` /
 * `waa_projects`, which HR/Admin has no direct grant on any more. So are the
 * shortcuts to payroll settings, the cash-advance ledger and supervisor
 * registration — all web-dashboard surfaces now. Don't re-add either; both
 * would need a new edge function, and the counters would put org-wide payroll
 * shape back on a phone the addendum wants narrow.
 *
 * The one shortcut that IS here is Sites. It's a different thing entirely from
 * the ones above: `waa_projects` has real HR/Admin insert/update policies
 * scoped to the caller's own company, and a site name/location was never a pay
 * figure — so it needs no edge function and exposes no payroll shape. It also
 * closes a hard gap: without it a newly onboarded company has no site, and
 * therefore no way for its supervisors to register anyone.
 */
export default function HrProfile() {
  const hrAdmin = useHrAdmin();
  const { signOut } = useSession();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need your login ID and password to get back in.', [
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
            <Text style={s.avatarText}>{initialsOf(hrAdmin.full_name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.greet}>{hrAdmin.full_name ?? 'HR / Admin'}</Text>
            <Text style={type.subgreet}>HR / Admin</Text>
            <Text style={s.email}>{hrAdmin.login_code ?? '—'}</Text>
          </View>
        </View>

        <Section title="Your details">
          <Card style={{ gap: 14 }}>
            {/* The login ID, not `session.user.email`: that is the synthetic
                address `waa-resolve-login` maps the code onto internally, and
                showing it would teach the wrong thing to type at sign-in. */}
            <Detail label="Login ID" value={hrAdmin.login_code ?? '—'} />
            <Detail label="Full name" value={hrAdmin.full_name ?? 'Not set'} />
            <Detail label="Phone" value={hrAdmin.phone || 'Not set'} />
            <Detail label="Contact email" value={hrAdmin.email || 'Not set'} />
          </Card>
          <Text style={s.note}>
            Your login ID is fixed at account creation and cannot be changed. Contact R3U support
            if you are locked out — they can issue a new temporary password against the same ID.
          </Text>
        </Section>

        <Section title="Company setup">
          <Card onPress={() => router.push('/(hr)/sites')} style={s.linkRow}>
            <View style={s.linkIcon}>
              <SiteGlyph size={17} color={colors.safetyDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.cardTitle}>Sites</Text>
              <Text style={type.cardSub}>
                Add and rename the projects your workers are assigned to.
              </Text>
            </View>
            <ChevronRightIcon size={16} color={colors.muted} />
          </Card>
        </Section>

        <Section title="On this phone">
          <Card>
            <Text style={s.scope}>
              Mobile is your emergency-approvals surface: cash advances, separation cases and
              proof-of-payment capture. The full payroll grid, run review and payroll settings stay
              on the web dashboard, at a desk.
            </Text>
          </Card>
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
  scope: { fontSize: 12.5, color: colors.ink, lineHeight: 19, fontFamily: fonts.body },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.pendingBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

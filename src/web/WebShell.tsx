import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../lib/session';
import { initialsOf } from '../lib/format';
import {
  ChartIcon,
  ChevronDownIcon,
  DoorExitIcon,
  GearIcon,
  LogoutIcon,
  PaletteIcon,
  PayslipIcon,
  SearchIcon,
  SiteIcon,
  TeamIcon,
  WalletIcon,
} from '../components/icons';
import { useWebTheme, webOnlyStyle } from './webTheme';
import { ColorThemeSwitcher, ModeSwitcher } from './webUi';
import { BODY, DISPLAY, T } from './nexusType';

/**
 * The R3U Suite glass shell for HR/Admin + Platform Owner —
 * R3U-WAA-WEB-REDESIGN.md. Supersedes `TopBar` + `ScreenBody` +
 * `HrDashboardNav` (src/components/) on every screen that imports it; those
 * three stay exactly as they were for Worker/Supervisor's native tabs, which
 * this file never touches.
 *
 * Restyled against `nexus-hris.html` (2026-09-04, per the user's explicit
 * direction to migrate the HR/Admin + Platform Owner web app onto it) — a
 * visual-language reference only, not a second backend: every control here
 * still drives the exact same 9 real screens/actions this app already has.
 * Three structural moves taken from that reference: the active nav item's
 * left accent bar (nexus's `.nitem.active::before`), the theme controls
 * collapsed behind one 🎨 icon that opens a floating panel instead of
 * sitting inline in the topbar at all times, and the user identity + sign
 * out moving from the sidebar footer into a topbar chip + dropdown (nexus
 * keeps the sidebar footer for an org/entity switcher, which this app has
 * no equivalent feature for — HR/Admin belongs to exactly one company, so
 * that slot is dropped rather than filled with a non-functional stand-in).
 */

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: (color: string, size: number) => React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const HR_NAV: NavGroup[] = [
  {
    label: 'Workforce',
    items: [
      { key: 'roster', label: 'Roster', href: '/(hr)/roster', icon: (c, s) => <TeamIcon color={c} size={s} /> },
      { key: 'payroll-grid', label: 'Payroll grid', href: '/(hr)/payroll-grid', icon: (c, s) => <PayslipIcon color={c} size={s} /> },
      { key: 'cash-advances', label: 'Cash advances', href: '/(hr)/cash-advances', icon: (c, s) => <WalletIcon color={c} size={s} /> },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: 'analytics', label: 'Analytics', href: '/(hr)/analytics', icon: (c, s) => <ChartIcon color={c} size={s} /> },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'separations-full', label: 'Separations', href: '/(hr)/separations-full', icon: (c, s) => <DoorExitIcon color={c} size={s} /> },
      { key: 'settings', label: 'Settings', href: '/(hr)/settings', icon: (c, s) => <GearIcon color={c} size={s} /> },
    ],
  },
];

const PLATFORM_OWNER_NAV: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { key: 'companies', label: 'Companies', href: '/(platform-owner)', icon: (c, s) => <SiteIcon color={c} size={s} /> },
    ],
  },
];

export function WebShell({
  active,
  title,
  subtitle,
  actions,
  children,
}: {
  active: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { role, hrAdmin, platformOwner, signOut } = useSession();
  const { palette } = useWebTheme();
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isPlatformOwner = role === 'platform_owner';
  const groups = isPlatformOwner ? PLATFORM_OWNER_NAV : HR_NAV;
  const principal = isPlatformOwner ? platformOwner : hrAdmin;
  const roleLabel = isPlatformOwner ? 'Platform owner' : 'HR admin';

  function closePopovers() {
    setThemePanelOpen(false);
    setUserMenuOpen(false);
  }

  return (
    <View
      style={[
        s.stage,
        { backgroundColor: palette.bg },
        webOnlyStyle({
          backgroundImage: `radial-gradient(1100px 560px at 6% -12%, ${hexAlpha(palette.accent, 0.22)}, transparent 60%), radial-gradient(950px 520px at 106% 8%, ${hexAlpha(palette.accent2, 0.16)}, transparent 55%), linear-gradient(165deg, ${palette.bg}, ${palette.bg2})`,
        }),
      ]}
    >
      <View
        style={s.shell}
        // Click-outside-to-close, without a full-screen overlay Pressable:
        // `topbar` and `sidebar` both set `backdropFilter`, which — like
        // `filter`/`opacity<1`/`transform` — establishes its own CSS
        // stacking context. An overlay `zIndex` can never out-rank content
        // trapped inside a descendant's own stacking context regardless of
        // how high the number is, so a real overlay here would need to sit
        // *inside* every such context to work, which defeats the point of
        // one shared catch-all. `onStartShouldSetResponder` sidesteps this
        // entirely: it fires on every touch that starts anywhere in this
        // subtree (same non-capturing technique `_layout.tsx` uses for idle-
        // activity tracking), and returning `false` lets the touch continue
        // on to whatever Pressable is actually under it — so a tap on the
        // Appearance/Account buttons still closes popovers first, then
        // immediately reopens the one that was tapped, once its own onPress
        // fires on release.
        onStartShouldSetResponder={() => {
          if (themePanelOpen || userMenuOpen) closePopovers();
          return false;
        }}
      >
        <View
          style={[
            s.sidebar,
            { borderRightColor: palette.border, backgroundColor: palette.panel },
            webOnlyStyle({ backdropFilter: 'blur(20px) saturate(160%)' }),
          ]}
        >
          <View style={s.brandRow}>
            {/* Real R3U wordmark (2026-09-04), replacing the gradient "R3"
                placeholder in this shared HR/Admin + Platform Owner shell —
                the source file has a solid white background, so it sits in
                a plain white chip rather than directly on the dark sidebar. */}
            <View style={s.brandMarkChip}>
              <Image source={require('../../assets/r3u-logo.jpg')} style={s.brandMarkImg} resizeMode="contain" />
            </View>
            <View>
              <Text style={[s.brandName, { color: palette.text }]}>R3U WAA</Text>
              <Text style={[s.brandSub, { color: palette.muted }]}>Worker's Attendance</Text>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.label} style={{ marginBottom: 4 }}>
                <Text style={[s.groupLabel, { color: palette.muted2 }]}>{group.label}</Text>
                {group.items.map((item) => {
                  const isActive = item.key === active;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        if (!isActive) router.push(item.href as never);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      style={({ pressed }) => [
                        s.navItem,
                        isActive
                          ? webOnlyStyle({
                              backgroundImage: `linear-gradient(135deg, ${hexAlpha(palette.accent, 0.26)}, ${hexAlpha(palette.accent2, 0.16)})`,
                              boxShadow: `inset 0 0 0 1px ${palette.border}`,
                            })
                          : null,
                        !isActive && pressed ? { backgroundColor: palette.hover } : null,
                      ]}
                    >
                      {isActive ? (
                        <View
                          style={[
                            s.navActiveBar,
                            webOnlyStyle({ backgroundImage: `linear-gradient(180deg, ${palette.accent}, ${palette.accent2})` }),
                          ]}
                        />
                      ) : null}
                      {item.icon(isActive ? palette.text : palette.muted, 16)}
                      <Text style={[isActive ? s.navTextActive : s.navText, { color: isActive ? palette.text : palette.muted }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={s.main}>
          <View
            style={[
              s.topbar,
              { borderBottomColor: palette.border, backgroundColor: palette.panel },
              webOnlyStyle({ backdropFilter: 'blur(14px)' }),
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.topTitle, { color: palette.text }]}>{title}</Text>
              {subtitle ? (
                <Text style={[s.topSub, { color: palette.muted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <View style={[s.search, { backgroundColor: palette.panelSolid, borderColor: palette.border }]}>
              <SearchIcon color={palette.muted} size={14} />
              <Text style={[s.searchText, { color: palette.muted }]}>Search workers, runs, sites…</Text>
            </View>

            {actions}

            <View style={s.popoverAnchor}>
              <Pressable
                onPress={() => {
                  setUserMenuOpen(false);
                  setThemePanelOpen((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityLabel="Appearance"
                style={[s.iconBtn, { borderColor: palette.border, backgroundColor: palette.panelSolid }]}
              >
                <PaletteIcon color={palette.text} size={16} />
              </Pressable>
              {themePanelOpen ? (
                <View
                  style={[
                    s.themePanel,
                    { backgroundColor: palette.panelSolid, borderColor: palette.border },
                    webOnlyStyle({ boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }),
                  ]}
                >
                  <Text style={[s.panelLabel, { color: palette.muted }]}>COLOR THEME</Text>
                  <ColorThemeSwitcher />
                  <View style={[s.panelDivider, { backgroundColor: palette.border }]} />
                  <Text style={[s.panelLabel, { color: palette.muted }]}>DISPLAY</Text>
                  <ModeSwitcher />
                </View>
              ) : null}
            </View>

            <View style={s.popoverAnchor}>
              <Pressable
                onPress={() => {
                  setThemePanelOpen(false);
                  setUserMenuOpen((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityLabel="Account menu"
                style={[s.userChip, { backgroundColor: palette.panelSolid, borderColor: palette.border }]}
              >
                <View
                  style={[
                    s.avatar,
                    webOnlyStyle({ backgroundImage: `linear-gradient(135deg, ${palette.accent}, ${palette.accent2})` }),
                  ]}
                >
                  <Text style={s.avatarText}>{initialsOf(principal?.full_name)}</Text>
                </View>
                <View style={{ minWidth: 0, maxWidth: 130 }}>
                  <Text style={[s.userName, { color: palette.text }]} numberOfLines={1}>
                    {principal?.full_name ?? roleLabel}
                  </Text>
                  <Text style={[s.userRole, { color: palette.muted }]} numberOfLines={1}>
                    {roleLabel}
                  </Text>
                </View>
                <ChevronDownIcon color={palette.muted} size={14} />
              </Pressable>
              {userMenuOpen ? (
                <View
                  style={[
                    s.userMenu,
                    { backgroundColor: palette.panelSolid, borderColor: palette.border },
                    webOnlyStyle({ boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }),
                  ]}
                >
                  <Pressable
                    onPress={signOut}
                    style={({ pressed }) => [s.userMenuItem, pressed && { backgroundColor: palette.hover }]}
                  >
                    <LogoutIcon color={palette.bad} size={15} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: palette.bad }}>Sign out</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} onScrollBeginDrag={closePopovers}>
            <View style={s.contentInner}>{children}</View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

/** `#RRGGBB` -> `rgba(r,g,b,a)`. Every accent in webTheme.ts is 6-digit hex. */
function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const s = StyleSheet.create({
  stage: { flex: 1 },
  shell: { flex: 1, flexDirection: 'row', minHeight: 640 },
  sidebar: {
    width: 246,
    borderRightWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 8, paddingBottom: 18 },
  brandMarkChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 4,
  },
  brandMarkImg: { width: '100%', height: '100%' },
  // nexus's `.logo b` / `.logo small`: 17px Outfit wordmark over a 9px,
  // 2.4px-tracked uppercase kicker.
  brandName: { fontFamily: DISPLAY.bold, fontSize: 16, letterSpacing: 0.4, lineHeight: 19 },
  brandSub: { fontFamily: BODY.bold, fontSize: 8.5, letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 },
  // `.nav-sec`: 9px / 800 / 2px tracking.
  groupLabel: { fontFamily: BODY.bold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 5 },
  // `.nitem`: 8.5px/12px padding, 11px radius, 12.8px label.
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 8.5, borderRadius: 11, marginBottom: 2, position: 'relative' } as ViewStyle,
  navActiveBar: { position: 'absolute', left: -1, top: '20%', bottom: '20%', width: 3, borderRadius: 3 } as ViewStyle,
  navText: { fontFamily: BODY.medium, fontSize: 12.8 },
  navTextActive: { fontFamily: BODY.semibold, fontSize: 12.8 },

  main: { flex: 1, minWidth: 0 },
  // `.topbar`: 62px tall, 0 20px padding.
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, height: 62, borderBottomWidth: 1 },
  topTitle: T.pageTitle,
  topSub: { ...T.crumb, marginTop: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 8, minWidth: 200, maxWidth: 380, flex: 1 },
  searchText: { fontFamily: BODY.regular, fontSize: 12.5 },
  content: { paddingBottom: 40 },
  contentInner: { padding: 24, width: '100%', maxWidth: 1180, alignSelf: 'center' },

  iconBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themePanel: {
    position: 'absolute',
    top: 46,
    right: 0,
    width: 260,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    zIndex: 90,
  } as ViewStyle,
  panelLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 9 },
  panelDivider: { height: 1, marginVertical: 13 },

  // `.uchip` / `.avatar` / `.un` / `.ur`.
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 5, paddingRight: 13 },
  avatar: { width: 31, height: 31, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: BODY.bold, fontSize: 11 },
  userName: { fontFamily: BODY.bold, fontSize: 12, lineHeight: 14 },
  userRole: { fontFamily: BODY.regular, fontSize: 9.5, marginTop: 1 },
  userMenu: {
    position: 'absolute',
    top: 46,
    right: 0,
    width: 180,
    borderWidth: 1,
    borderRadius: 14,
    padding: 6,
    zIndex: 90,
  } as ViewStyle,
  userMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10 },
  // Keeps each dropdown panel stacked above its topbar siblings (the search
  // box, the other icon button) within `topbar`'s own local stacking context
  // — `topbar` sets `backdropFilter`, which establishes one, so this only
  // ever has to win locally, never against anything outside it.
  popoverAnchor: { position: 'relative', zIndex: 100 } as ViewStyle,
});

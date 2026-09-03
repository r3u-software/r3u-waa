import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../lib/session';
import { initialsOf } from '../lib/format';
import {
  ChartIcon,
  DoorExitIcon,
  GearIcon,
  LogoutIcon,
  PayslipIcon,
  SearchIcon,
  SiteIcon,
  TeamIcon,
  WalletIcon,
} from '../components/icons';
import { useWebTheme, webOnlyStyle } from './webTheme';
import { ColorThemeSwitcher, ModeSwitcher } from './webUi';

/**
 * The R3U Suite glass shell for HR/Admin + Platform Owner —
 * R3U-WAA-WEB-REDESIGN.md. Supersedes `TopBar` + `ScreenBody` +
 * `HrDashboardNav` (src/components/) on every screen that imports it; those
 * three stay exactly as they were for Worker/Supervisor's native tabs, which
 * this file never touches.
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
  const { palette, themeId, themes, setThemeId } = useWebTheme();

  const isPlatformOwner = role === 'platform_owner';
  const groups = isPlatformOwner ? PLATFORM_OWNER_NAV : HR_NAV;
  const principal = isPlatformOwner ? platformOwner : hrAdmin;
  const roleLabel = isPlatformOwner ? 'Platform owner' : 'HR admin';

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
      <View style={s.shell}>
        <View
          style={[
            s.sidebar,
            { borderRightColor: palette.border, backgroundColor: palette.panel },
            webOnlyStyle({ backdropFilter: 'blur(20px) saturate(160%)' }),
          ]}
        >
          <View style={s.brandRow}>
            <View
              style={[
                s.brandMark,
                webOnlyStyle({ backgroundImage: `linear-gradient(135deg, ${palette.accent}, ${palette.accent2})` }),
              ]}
            >
              <Text style={s.brandMarkText}>R3</Text>
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
                      {item.icon(isActive ? palette.text : palette.muted, 16)}
                      <Text style={[s.navText, { color: isActive ? palette.text : palette.muted }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={[s.userChip, { backgroundColor: palette.panelSolid, borderColor: palette.border }]}>
            <View
              style={[
                s.avatar,
                webOnlyStyle({ backgroundImage: `linear-gradient(135deg, ${palette.accent}, ${palette.accent2})` }),
              ]}
            >
              <Text style={s.avatarText}>{initialsOf(principal?.full_name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.userName, { color: palette.text }]} numberOfLines={1}>
                {principal?.full_name ?? roleLabel}
              </Text>
              <Text style={[s.userRole, { color: palette.muted }]} numberOfLines={1}>
                {roleLabel}
              </Text>
            </View>
            <Pressable onPress={signOut} accessibilityLabel="Sign out" hitSlop={8}>
              <LogoutIcon color={palette.muted} size={16} />
            </Pressable>
          </View>
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

            <ColorThemeSwitcher compact />

            <ModeSwitcher compact />

            {actions}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
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
  brandMark: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  brandName: { fontSize: 14.5, fontWeight: '700', lineHeight: 17 },
  brandSub: { fontSize: 10.5, marginTop: 1 },
  groupLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 5 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, marginBottom: 2 } as ViewStyle,
  navText: { fontSize: 13, fontWeight: '600' },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 11, padding: 8, marginTop: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  userName: { fontSize: 12.5, fontWeight: '600' },
  userRole: { fontSize: 10.5, marginTop: 1 },

  main: { flex: 1, minWidth: 0 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 15, borderBottomWidth: 1, flexWrap: 'wrap' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  topSub: { fontSize: 12, marginTop: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 8, minWidth: 200 },
  searchText: { fontSize: 12.5 },
  content: { paddingBottom: 40 },
  contentInner: { padding: 24, width: '100%', maxWidth: 1180, alignSelf: 'center' },
});

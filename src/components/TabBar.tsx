import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// expo-router 57 vendors React Navigation internally rather than depending on
// the standalone @react-navigation packages, so the tab-bar prop type comes
// out of the js-tabs entry point.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useWebTheme } from '../web/webTheme';

/**
 * Glass tab bar — R3U-WAA-WEB-REDESIGN.md's native follow-up. Shared by
 * Worker and Supervisor's `(tabs)/_layout.tsx`; each mounts its own
 * `WebThemeProvider` (fixed Aurora/dark), so this reads the same
 * `useWebTheme()` the rest of that role's screens do rather than the old
 * `colors.paper`/`colors.safety` pairing.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useWebTheme();

  return (
    <BlurView intensity={40} tint="dark" style={[s.bar, { borderTopColor: palette.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = (options.title ?? route.name) as string;
        const color = focused ? '#fff' : palette.muted;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const icon = options.tabBarIcon?.({ focused, color, size: 19 });

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={s.item}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
          >
            {focused ? (
              <LinearGradient
                colors={[palette.accent, palette.accent2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.activePill}
              >
                {icon}
                <Text style={[s.label, { color: '#fff' }]}>{label}</Text>
              </LinearGradient>
            ) : (
              <View style={s.inactivePill}>
                {icon}
                <Text style={[s.label, { color }]}>{label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </BlurView>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: 'center' },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  inactivePill: { alignItems: 'center', gap: 3, paddingVertical: 2 },
  label: { fontSize: 10.5, fontWeight: '700' },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// expo-router 57 vendors React Navigation internally rather than depending on
// the standalone @react-navigation packages, so the tab-bar prop type comes
// out of the js-tabs entry point.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colors, fonts } from '../theme';

/**
 * Custom tab bar reproducing the mockup's bottom nav: label under a line
 * icon, and a small safety-orange dot under the active item.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = (options.title ?? route.name) as string;
        const color = focused ? colors.ink : colors.muted;

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

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={s.item}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
          >
            {options.tabBarIcon?.({ focused, color, size: 20 })}
            <Text style={[s.label, { color }]}>{label}</Text>
            <View style={[s.dot, focused && s.dotActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 10, fontFamily: fonts.bodySemi },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 1 },
  dotActive: { backgroundColor: colors.safety },
});

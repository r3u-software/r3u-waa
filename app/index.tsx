import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../src/theme';

/**
 * Entry route. The guard in `_layout.tsx` immediately redirects to /login or
 * into the correct role group, so this only ever flashes for a frame.
 */
export default function Index() {
  return (
    <View style={s.root}>
      <ActivityIndicator color={colors.safety} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});

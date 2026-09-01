import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';
import { getSignedUrl } from '../lib/storage';
import type { WaaBucket } from '../lib/types';
import { UserIcon } from './icons';

/**
 * Renders an object from a private bucket by minting a signed URL for it.
 * Falls back to a steel-gradient placeholder (matching the mockup's
 * `.evidence-thumb`) while loading or when the object is missing.
 */
export function SignedImage({
  bucket,
  path,
  size = 44,
  radius: r = radius.sm,
  style,
}: {
  bucket: WaaBucket;
  path: string | null | undefined;
  size?: number;
  radius?: number;
  style?: ViewStyle & ImageStyle;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSignedUrl(bucket, path).then((u) => {
      if (!active) return;
      setUrl(u);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [bucket, path]);

  const box = { width: size, height: size, borderRadius: r };

  if (url) {
    return <Image source={{ uri: url }} style={[box, style as ImageStyle]} resizeMode="cover" />;
  }

  return (
    <View style={[s.placeholder, box, style]}>
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <UserIcon size={Math.round(size * 0.36)} color="#fff" />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

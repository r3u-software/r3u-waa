import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/**
 * Web fallback for the native `react-native-webview`-backed PDF viewer.
 * A plain `<iframe>` renders PDFs directly in every modern desktop browser
 * (Chrome, Edge, Firefox, Safari) with no extra library — simpler than the
 * native Android/Google-viewer workaround. Per WEB-DEPLOYMENT-ADDENDUM.md.
 */
export function PdfViewer({ url }: { url: string }) {
  return (
    <View style={s.root}>
      {/* @ts-expect-error -- RN's JSX.IntrinsicElements doesn't declare "iframe";
          this file only ever bundles for web (via the .web.tsx filename), where
          react-native-web renders it as a real DOM element. */}
      <iframe src={url} title="Document" style={s.frame} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  frame: { flex: 1, border: 'none', width: '100%', height: '100%' } as any,
});

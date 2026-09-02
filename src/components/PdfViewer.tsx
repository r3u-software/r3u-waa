import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

/**
 * Native (Android/iOS) PDF viewer, backed by react-native-webview.
 *
 * `react-native-webview` has no `.web.*` implementation, so this file is
 * paired with `PdfViewer.web.tsx` — Metro/webpack picks whichever matches
 * the target platform automatically via the filename convention. Callers
 * just `import { PdfViewer } from '.../components/PdfViewer'` and never
 * need to know which one loaded.
 *
 * Android's WebView has no built-in PDF renderer, so the URL is handed to
 * Google's viewer there; iOS renders PDFs natively.
 */
export function PdfViewer({ url }: { url: string }) {
  const source =
    Platform.OS === 'android'
      ? { uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}` }
      : { uri: url };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <WebView
        source={source}
        style={{ flex: 1 }}
        startInLoadingState
        renderLoading={() => (
          <View style={s.center}>
            <ActivityIndicator color={colors.steel} />
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
});

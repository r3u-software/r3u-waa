import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useWorker } from '../../src/lib/session';
import { getSignedUrl } from '../../src/lib/storage';
import { EmptyState } from '../../src/components/ui';
import { PdfViewer } from '../../src/components/PdfViewer';
import { colors, fonts, spacing } from '../../src/theme';

/**
 * Read-only contract viewer.
 *
 * There is deliberately NO upload or replace control here — contracts are
 * supervisor-uploaded only, per the brief.
 *
 * This screen only ever runs on Android (Worker stays field/Android-only per
 * WEB-DEPLOYMENT-ADDENDUM.md), but the actual PDF rendering is delegated to
 * `PdfViewer`, which also has a web fallback — kept in sync in case a future
 * HR/Admin web screen needs to show the same contract.
 */
export default function ContractScreen() {
  const worker = useWorker();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSignedUrl('waa-contracts', worker.contract_pdf_url).then((signed) => {
      if (!active) return;
      setUrl(signed);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [worker.contract_pdf_url]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.steel} />
        <Text style={s.hint}>Opening your contract…</Text>
      </View>
    );
  }

  if (!worker.contract_pdf_url || !url) {
    return (
      <View style={s.pad}>
        <EmptyState
          title="No contract uploaded yet"
          body="Your supervisor attaches your signed contract here once it is ready. You will be able to read it, but not edit or replace it."
        />
      </View>
    );
  }

  return <PdfViewer url={url} />;
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.paper,
  },
  hint: { fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  pad: { flex: 1, padding: spacing.xl, backgroundColor: colors.paper, justifyContent: 'center' },
});

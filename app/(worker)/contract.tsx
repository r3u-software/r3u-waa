import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useWorker } from '../../src/lib/session';
import { getSignedUrl } from '../../src/lib/storage';
import { EmptyState } from '../../src/components/ui';
import { PdfViewer } from '../../src/components/PdfViewer';
import { useWebTheme } from '../../src/web/webTheme';
import { GlassScreen } from '../../src/web/webUi';

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
  const { palette } = useWebTheme();
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
      <GlassScreen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color={palette.muted} />
          <Text style={{ fontSize: 12, color: palette.muted }}>Opening your contract…</Text>
        </View>
      </GlassScreen>
    );
  }

  if (!worker.contract_pdf_url || !url) {
    return (
      <GlassScreen>
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <EmptyState
            title="No contract uploaded yet"
            body="Your supervisor attaches your signed contract here once it is ready. You will be able to read it, but not edit or replace it."
          />
        </View>
      </GlassScreen>
    );
  }

  return <PdfViewer url={url} />;
}

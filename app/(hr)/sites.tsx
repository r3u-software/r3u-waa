import React, { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useSession } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { createSite, fetchProjects, updateSite } from '../../src/lib/queries';
import type { WaaProject } from '../../src/lib/types';
import { EmptyState } from '../../src/components/ui';
import { MapPinIcon } from '../../src/components/icons';
import { useWebTheme } from '../../src/web/webTheme';
import {
  GlassButton,
  GlassCard,
  GlassErrorBanner,
  GlassField,
  GlassListRow,
  GlassOutlineButton,
  GlassScreen,
  WebPageHeader,
} from '../../src/web/webUi';

/**
 * HR/Admin site management — the one in-app way to create a `waa_projects` row.
 *
 * Before this screen existed every site was hand-seeded via SQL, which left a
 * newly onboarded company with nowhere to assign workers: the supervisor's
 * "Register worker" screen needs a site, and its site list comes from this
 * table.
 *
 * Direct Supabase calls on purpose. `waa_projects` has genuine insert/update
 * policies for HR/Admin scoped to `company_id = waa_current_company_id()`, and
 * a site's name/location is not a pay figure — so this is outside the Option A
 * "everything HR/Admin touches goes through an edge function" boundary, which
 * only ever covered the payroll/money tables.
 *
 * The list itself is `fetchProjects()` unfiltered: the SELECT policy is already
 * company-scoped, so what comes back is this company's sites and nothing else.
 * No client-side company filter is layered on top of that, deliberately — it
 * would imply the boundary lives here rather than in the database.
 *
 * Reskinned onto the glass system — R3U-WAA-WEB-REDESIGN.md's follow-up.
 */
export default function HrSitesScreen() {
  const { companyId } = useSession();
  const { palette } = useWebTheme();
  const { data: sites, loading, error, reload } = useAsync(() => fetchProjects(), []);

  /** null = closed, 'new' = create form, otherwise the site being edited. */
  const [editing, setEditing] = useState<WaaProject | 'new' | null>(null);

  return (
    <>
      <GlassScreen>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
          <WebPageHeader eyebrow="Company setup" title="Sites" sub="The projects your workers are assigned to and punch against." />

          {error ? <GlassErrorBanner message={error} /> : null}

          <GlassButton label="New site" onPress={() => setEditing('new')} style={{ marginBottom: 22 }} />

          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>
            Your sites{sites ? ` (${sites.length})` : ''}
          </Text>
          {(sites?.length ?? 0) === 0 ? (
            <EmptyState title="No sites yet" body="Add your first site so supervisors have somewhere to register workers." />
          ) : (
            sites!.map((site) => (
              <GlassListRow
                key={site.id}
                icon={<MapPinIcon size={17} color={palette.text} />}
                title={site.name}
                subtitle={site.location || 'No location set'}
                onPress={() => setEditing(site)}
                pillLabel="Edit"
              />
            ))
          )}

          <GlassCard style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8 }}>
            <MapPinIcon size={17} color={palette.muted} />
            <Text style={{ flex: 1, fontSize: 11.5, color: palette.muted, lineHeight: 17 }}>
              A site's location is a plain label for people to read — punches record their own GPS separately and are never blocked by
              distance from it.
            </Text>
          </GlassCard>
        </ScrollView>
      </GlassScreen>

      {/* Keyed + conditionally mounted so each open starts from that site's
          own values rather than whatever the previous open left behind. */}
      {editing ? (
        <SiteFormModal
          key={editing === 'new' ? 'new' : editing.id}
          target={editing}
          companyId={companyId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

/* ----------------------------------------------------- Create / edit --- */

function SiteFormModal({
  target,
  companyId,
  onClose,
  onSaved,
}: {
  target: WaaProject | 'new';
  companyId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { palette } = useWebTheme();
  const isNew = target === 'new';
  const existing = target !== 'new' ? target : null;

  // Mounted fresh per open (see the `key` at the call site), so these
  // initializers are the reset — there is no effect syncing them afterward.
  const [name, setName] = useState(existing?.name ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a site name.');
      return;
    }

    setBusy(true);
    try {
      if (isNew) {
        // The insert policy checks this against waa_current_company_id(), so a
        // missing/foreign value is refused by the database, not by this check —
        // this only avoids sending an insert that is certain to fail.
        if (!companyId) {
          setError('Your account has no company on file. Contact R3U support.');
          return;
        }
        await createSite({
          name: trimmedName,
          location: location.trim() || null,
          company_id: companyId,
        });
      } else if (existing) {
        await updateSite(existing.id, {
          name: trimmedName,
          location: location.trim() || null,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the site.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: palette.panelSolid, borderWidth: 1, borderColor: palette.border, borderRadius: 20, maxHeight: '85%' }}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{isNew ? 'New site' : 'Edit site'}</Text>
            <Text style={{ fontSize: 12.5, color: palette.muted, lineHeight: 18, marginTop: 4, marginBottom: 16 }}>
              {isNew
                ? 'Supervisors pick from this list when they register a worker.'
                : 'Renaming a site updates it everywhere — existing punches and assignments stay attached.'}
            </Text>

            {error ? <GlassErrorBanner message={error} /> : null}

            <GlassField label="Site name" value={name} onChangeText={setName} placeholder="Ortigas Tower 3" autoCapitalize="words" />
            <GlassField
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="Pasig City"
              autoCapitalize="words"
              hint="Optional. A human-readable address or area."
            />

            <GlassButton label={busy ? 'Saving…' : isNew ? 'Create site' : 'Save changes'} onPress={submit} loading={busy} />
            <GlassOutlineButton label="Cancel" onPress={onClose} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

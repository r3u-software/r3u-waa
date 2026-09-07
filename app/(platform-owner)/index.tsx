import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlatformOwner } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import {
  poCreateCompany,
  poListCompanies,
  poResetHrAdminPassword,
  poToggleCompanyActive,
} from '../../src/lib/platformOwner';
import type { PlatformOwnerCompany, PlatformOwnerHrAdmin } from '../../src/lib/types';
import {
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Loader,
  Pill,
} from '../../src/components/ui';
import { ChevronDownIcon, ChevronRightIcon, LockIcon } from '../../src/components/icons';
import { colors, fonts, radius, spacing, type } from '../../src/theme';
import { WebShell } from '../../src/web/WebShell';
import { useWebTheme } from '../../src/web/webTheme';
import { GlassButton, GlassOutlineButton, WebPageHeader, WebSection } from '../../src/web/webUi';
import { DISPLAY } from '../../src/web/nexusType';

/**
 * Platform Owner home — three actions, one page.
 *
 * Deliberately plainer than the Worker/Supervisor/HR-Admin surfaces: this is an
 * internal operations tool run by one person, not a product screen. Same theme
 * tokens and the same Card/Section/PrimaryButton components as everywhere else,
 * but no tab bar, no charts, no dashboard.
 *
 * All four reads and writes go through the Platform-Owner-only edge functions
 * in `src/lib/platformOwner.ts`. There is no `supabase.from('waa_…')` call on
 * this screen and there must never be one — Platform Owner holds no direct RLS
 * grant on any table, which is the whole point given that its blast radius is
 * every company at once.
 *
 * The reset-password picker and the suspend/reactivate list are two views of
 * one `poListCompanies()` call, not two fetches.
 */

/** What gets shown in the once-only credentials modal, whoever produced it. */
interface IssuedCredentials {
  heading: string;
  context: string;
  loginCode: string;
  tempPassword: string;
}

export default function PlatformOwnerHome() {
  const owner = usePlatformOwner();

  const { data: companies, loading, error, reload } = useAsync(() => poListCompanies(), []);
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null);

  return (
    <WebShell active="companies" title="Companies" subtitle={`Signed in as ${owner.full_name} · ${owner.email}`}>
      <WebPageHeader eyebrow="Platform" title="Companies" sub="Onboard companies, reset HR/Admin passwords, suspend or reactivate access." />

        {error ? <ErrorNote message={error} /> : null}

        <CreateCompanySection
          onIssued={(result) => {
            setCredentials({
              heading: 'Company created',
              context:
                'This is the first HR/Admin for the new company. Relay these two now — ' +
                'neither can be retrieved again.',
              loginCode: result.hr_admin_login_code,
              tempPassword: result.hr_admin_temp_password,
            });
            reload();
          }}
        />

        <ResetPasswordSection
          companies={companies}
          loading={loading}
          onIssued={(result) => {
            setCredentials({
              heading: 'Password reset',
              context:
                'A new temporary password has been issued. The login ID is unchanged. ' +
                'Relay this now — it cannot be retrieved again.',
              loginCode: result.hr_admin_login_code,
              tempPassword: result.hr_admin_temp_password,
            });
            reload();
          }}
        />

        <SuspendSection companies={companies} loading={loading} onChanged={reload} />

      <CredentialsModal issued={credentials} onDismiss={() => setCredentials(null)} />
    </WebShell>
  );
}

/* ----------------------------------------------------- Create company --- */

const EMPTY_FORM = {
  company_name: '',
  registration_number: '',
  business_address: '',
  primary_contact_name: '',
  primary_contact_phone: '',
  primary_contact_email: '',
};

function CreateCompanySection({
  onIssued,
}: {
  onIssued: (result: { hr_admin_login_code: string; hr_admin_temp_password: string }) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // All six are required. The edge function validates them too and answers a
  // 400 naming what is missing — this only avoids sending a request that is
  // certain to fail, it is not where the rule lives.
  const complete = Object.values(form).every((v) => v.trim().length > 0);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const result = await poCreateCompany({
        company_name: form.company_name.trim(),
        registration_number: form.registration_number.trim(),
        business_address: form.business_address.trim(),
        primary_contact_name: form.primary_contact_name.trim(),
        primary_contact_phone: form.primary_contact_phone.trim(),
        primary_contact_email: form.primary_contact_email.trim(),
      });
      setForm({ ...EMPTY_FORM });
      setOpen(false);
      onIssued(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that company.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <WebSection title="Onboard a company">
      <Card>
        <Pressable style={s.disclosure} onPress={() => setOpen((v) => !v)}>
          <View style={{ flex: 1 }}>
            <Text style={type.cardTitle}>New company</Text>
            <Text style={type.cardSub}>
              Creates the company and its first HR/Admin account in one step.
            </Text>
          </View>
          {open ? (
            <ChevronDownIcon size={16} color={colors.muted} />
          ) : (
            <ChevronRightIcon size={16} color={colors.muted} />
          )}
        </Pressable>

        {open ? (
          <View style={s.formBody}>
            {error ? <ErrorNote message={error} /> : null}

            <Field
              label="Registered company name"
              value={form.company_name}
              onChangeText={(v) => set('company_name', v)}
              placeholder="Northgate Builders Inc."
              autoCapitalize="words"
            />
            <Field
              label="Registration / permit number"
              value={form.registration_number}
              onChangeText={(v) => set('registration_number', v)}
              placeholder="SEC-2026-001234"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Field
              label="Business address"
              value={form.business_address}
              onChangeText={(v) => set('business_address', v)}
              placeholder="12 Shaw Blvd, Mandaluyong City"
              autoCapitalize="words"
              multiline
            />
            <Field
              label="Primary contact name"
              value={form.primary_contact_name}
              onChangeText={(v) => set('primary_contact_name', v)}
              placeholder="Maria Santos"
              autoCapitalize="words"
            />
            <Field
              label="Primary contact phone"
              value={form.primary_contact_phone}
              onChangeText={(v) => set('primary_contact_phone', v)}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
            />
            <Field
              label="Primary contact email"
              value={form.primary_contact_email}
              onChangeText={(v) => set('primary_contact_email', v)}
              placeholder="maria@northgate.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              hint="Business contact for the company — not an HR/Admin login."
            />

            <GlassButton
              label={busy ? 'Creating…' : 'Create company'}
              onPress={submit}
              loading={busy}
              disabled={!complete}
            />
            {!complete ? (
              <Text style={s.requireNote}>All six fields are required.</Text>
            ) : null}
            <GlassOutlineButton
              label="Cancel"
              onPress={() => {
                setForm({ ...EMPTY_FORM });
                setError(null);
                setOpen(false);
              }}
              style={{ marginTop: 10 }}
            />
          </View>
        ) : null}
      </Card>
    </WebSection>
  );
}

/* ------------------------------------------- Reset HR/Admin password --- */

function ResetPasswordSection({
  companies,
  loading,
  onIssued,
}: {
  companies: PlatformOwnerCompany[] | null;
  loading: boolean;
  onIssued: (result: { hr_admin_login_code: string; hr_admin_temp_password: string }) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirm(company: PlatformOwnerCompany, admin: PlatformOwnerHrAdmin) {
    const who = admin.full_name || admin.login_code || 'this HR/Admin';
    Alert.alert(
      'Reset this password?',
      `${who} at ${company.name} will be signed out of nothing, but their current password ` +
        'stops working immediately. You will get a new temporary password to relay to them, ' +
        'shown once.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset password', style: 'destructive', onPress: () => run(admin) },
      ]
    );
  }

  async function run(admin: PlatformOwnerHrAdmin) {
    setError(null);
    setBusyId(admin.id);
    try {
      const result = await poResetHrAdminPassword(admin.id);
      onIssued(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset that password.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WebSection title="Reset an HR/Admin password">
      {error ? <ErrorNote message={error} /> : null}

      {loading && !companies ? (
        <Loader label="Loading companies…" />
      ) : (companies?.length ?? 0) === 0 ? (
        <EmptyState title="No companies yet" body="Onboard one above to get started." />
      ) : (
        companies!.map((c) => {
          const expanded = expandedId === c.id;
          return (
            <Card key={c.id}>
              <Pressable
                style={s.disclosure}
                onPress={() => setExpandedId(expanded ? null : c.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={type.cardTitle}>{c.name}</Text>
                  <Text style={type.cardSub}>
                    {c.hr_admins.length === 1
                      ? '1 HR/Admin account'
                      : `${c.hr_admins.length} HR/Admin accounts`}
                  </Text>
                </View>
                {expanded ? (
                  <ChevronDownIcon size={16} color={colors.muted} />
                ) : (
                  <ChevronRightIcon size={16} color={colors.muted} />
                )}
              </Pressable>

              {expanded ? (
                <View style={s.adminList}>
                  {c.hr_admins.length === 0 ? (
                    <Text style={s.adminEmpty}>
                      This company has no HR/Admin account on file.
                    </Text>
                  ) : (
                    c.hr_admins.map((a) => (
                      <View key={a.id} style={s.adminRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.adminCode}>{a.login_code ?? 'No login code'}</Text>
                          <Text style={s.adminName}>
                            {a.full_name ?? 'Name not set yet'}
                            {a.must_change_password ? ' · password reset pending' : ''}
                            {!a.profile_complete ? ' · profile incomplete' : ''}
                          </Text>
                        </View>
                        <GlassOutlineButton
                          label={busyId === a.id ? 'Resetting…' : 'Reset'}
                          onPress={() => confirm(c, a)}
                          disabled={busyId !== null}
                          style={s.adminBtn}
                        />
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </WebSection>
  );
}

/* ------------------------------------------- Suspend / reactivate --- */

function SuspendSection({
  companies,
  loading,
  onChanged,
}: {
  companies: PlatformOwnerCompany[] | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirm(company: PlatformOwnerCompany) {
    const suspending = company.active;
    Alert.alert(
      suspending ? 'Suspend this company?' : 'Reactivate this company?',
      suspending
        ? `Everyone at ${company.name} will be refused at sign-in. Sessions already open stay ` +
            'valid until they expire on their own.'
        : `${company.name} will be able to sign in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: suspending ? 'Suspend' : 'Reactivate',
          style: suspending ? 'destructive' : 'default',
          onPress: () => run(company),
        },
      ]
    );
  }

  async function run(company: PlatformOwnerCompany) {
    setError(null);
    setBusyId(company.id);
    try {
      await poToggleCompanyActive(company.id, !company.active);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change that company’s status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WebSection title="Companies">
      {error ? <ErrorNote message={error} /> : null}

      {loading && !companies ? (
        <Loader label="Loading companies…" />
      ) : (companies?.length ?? 0) === 0 ? (
        <EmptyState title="No companies yet" body="Onboard one above to get started." />
      ) : (
        companies!.map((c) => (
          <Card key={c.id}>
            <View style={s.companyHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type.cardTitle}>{c.name}</Text>
                <Text style={type.cardSub}>
                  {c.registration_number ?? 'No registration number on file'}
                </Text>
              </View>
              <Pill
                label={c.active ? 'Active' : 'Suspended'}
                tone={c.active ? 'ok' : 'warn'}
              />
            </View>

            {c.business_address ? (
              <Text style={s.companyMeta}>{c.business_address}</Text>
            ) : null}
            {c.primary_contact_name ? (
              <Text style={s.companyMeta}>
                {c.primary_contact_name}
                {c.primary_contact_phone ? ` · ${c.primary_contact_phone}` : ''}
                {c.primary_contact_email ? ` · ${c.primary_contact_email}` : ''}
              </Text>
            ) : null}

            <GlassButton
              label={
                busyId === c.id ? 'Saving…' : c.active ? 'Suspend company' : 'Reactivate company'
              }
              tone={c.active ? 'warn' : 'good'}
              onPress={() => confirm(c)}
              disabled={busyId !== null}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ))
      )}

      <Card style={s.note}>
        <LockIcon size={17} color={colors.steel} />
        <Text style={s.noteText}>
          Suspension is checked at sign-in. A session already open keeps working until it expires
          on its own — suspending does not cut anyone off mid-shift.
        </Text>
      </Card>
    </WebSection>
  );
}

/* ------------------------------------------- Once-only credentials --- */

/**
 * The one place either generated credential is ever visible. Nothing stores
 * them: dismissing this modal is the point of no return, so the copy says so
 * plainly and the dismiss button is an acknowledgement, not an "OK".
 */
function CredentialsModal({
  issued,
  onDismiss,
}: {
  issued: IssuedCredentials | null;
  onDismiss: () => void;
}) {
  const { palette } = useWebTheme();
  const credBoxStyle = [
    s.credBox,
    { backgroundColor: palette.panelSolid, borderColor: palette.border, borderWidth: 1 },
  ];
  return (
    <Modal visible={!!issued} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: palette.panelSolid }]}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Text style={[s.sheetTitle, { color: palette.text }]}>{issued?.heading}</Text>
            <Text style={[s.sheetSub, { color: palette.muted }]}>{issued?.context}</Text>

            <View style={credBoxStyle}>
              <Text style={[s.credLabel, { color: palette.muted }]}>HR/ADMIN LOGIN ID</Text>
              <Text style={[s.credValue, { color: palette.text }]} selectable>
                {issued?.loginCode}
              </Text>
            </View>
            <View style={credBoxStyle}>
              <Text style={[s.credLabel, { color: palette.muted }]}>TEMPORARY PASSWORD</Text>
              <Text style={[s.credValue, { color: palette.accent2 }]} selectable>
                {issued?.tempPassword}
              </Text>
            </View>

            <View style={[s.warnBox, { backgroundColor: palette.warnBg }]}>
              <Text style={[s.warnText, { color: palette.warn }]}>
                Copy these down now. This is the only time they will be shown — there is no way to
                read them back, and the only recovery is issuing a fresh temporary password.
              </Text>
            </View>

            <Text style={[s.tip, { color: palette.muted }]}>
              The HR/Admin signs in with the login ID above (not an email address), is forced to
              set their own password, then fills in their profile.
            </Text>

            <GlassButton
              label="I have copied these down"
              onPress={onDismiss}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------ Styles --- */

const s = StyleSheet.create({
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  formBody: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  requireNote: {
    fontSize: 11.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: fonts.body,
  },

  adminList: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 10,
  },
  adminEmpty: { fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  adminCode: { fontSize: 14, fontFamily: fonts.bodyBold, letterSpacing: 0.5 },
  adminName: { fontSize: 11.5, color: colors.muted, marginTop: 2, fontFamily: fonts.body },
  adminBtn: { paddingHorizontal: 16, paddingVertical: 9 },

  companyHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  companyMeta: { fontSize: 11.5, color: colors.muted, marginTop: 6, fontFamily: fonts.body },

  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderStyle: 'dashed',
    marginTop: spacing.sm,
    marginBottom: 30,
  },
  noteText: { flex: 1, fontSize: 11.5, color: colors.muted, lineHeight: 17, fontFamily: fonts.body },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,27,24,0.6)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  // Real R3U-WAA glass sheet (2026-09-07) — this was a literal
  // `colors.paper` white popup with `fonts.serif` headings sitting on top
  // of the otherwise-dark glass dashboard, the most visually jarring paper
  // leftover on this page. Layout-only here now; color comes from the
  // `palette` overrides at each JSX call site above, same pattern
  // `credBoxStyle` (built inline, a few lines up) already used.
  sheet: { borderRadius: 20, maxHeight: '85%' },
  sheetTitle: { fontFamily: DISPLAY.bold, fontSize: 22 },
  sheetSub: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: spacing.lg,
    fontFamily: fonts.body,
  },
  credBox: { borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  credLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: fonts.bodyBold,
    marginBottom: 5,
  },
  credValue: { fontSize: 17, fontFamily: fonts.bodySemi, letterSpacing: 1 },
  warnBox: {
    borderRadius: radius.lg,
    padding: 12,
    marginTop: 4,
  },
  warnText: { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.bodySemi },
  tip: { fontSize: 11.5, lineHeight: 17, marginTop: 10, fontFamily: fonts.body },
});

import { supabase } from './supabase';
import type {
  CreateCompanyResult,
  PlatformOwnerCompany,
  ResetHrAdminPasswordResult,
} from './types';

/**
 * Platform Owner's entire data surface — four edge functions, nothing else.
 *
 * Platform Owner has **zero direct RLS grant on any table**, not even
 * `waa_companies`. That is deliberate and stricter than HR/Admin's mobile
 * scoping: its blast radius if a session were stolen is every company at once,
 * so there is no broad table for a compromised token to fall back on. Never
 * add a `supabase.from('waa_…')` call here — the one exception is the
 * `waa_platform_owners` self-row read in `session.tsx`, which is how the role
 * is resolved in the first place.
 *
 * Every function below is invoked through `supabase.functions.invoke`, which
 * attaches the caller's session as the `Authorization` header; each function
 * re-checks server-side that the caller is the Platform Owner before doing
 * anything with the service role.
 */

type Json = Record<string, unknown>;

/**
 * Same error unwrapping as `hrMobile.ts`: the functions answer `{ error }` on
 * a non-2xx, which supabase-js buries inside `FunctionsHttpError.context`.
 * Surfaced here so the create-company form can show the server's own
 * missing-field 400 verbatim rather than "non-2xx status code".
 */
async function callPoFunction<T>(slug: string, body: Json, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(slug, { body });
  if (!error) return data as T;

  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    const parsed = await ctx
      .clone()
      .json()
      .catch(() => null);
    if (parsed && typeof parsed.error === 'string') throw new Error(parsed.error);
  }
  const legacyBody = (ctx as { body?: unknown } | undefined)?.body;
  if (typeof legacyBody === 'string' && legacyBody) throw new Error(legacyBody);
  throw new Error((error as { message?: string }).message || fallback);
}

/* ------------------------------------------------------- List companies --- */

/**
 * Every company plus its HR/Admin(s). Backs all three of the home screen's
 * sections that need existing data — the reset-password picker and the
 * suspend/reactivate list share this one call rather than fetching twice.
 */
export async function poListCompanies(): Promise<PlatformOwnerCompany[]> {
  const res = await callPoFunction<{ items: PlatformOwnerCompany[] }>(
    'waa-platform-owner-list-companies',
    {},
    'Could not load companies.'
  );
  return res.items ?? [];
}

/* ------------------------------------------------------ Create company --- */

export interface CreateCompanyInput {
  company_name: string;
  registration_number: string;
  business_address: string;
  primary_contact_name: string;
  primary_contact_phone: string;
  primary_contact_email: string;
}

/**
 * Creates the company AND auto-provisions its first HR/Admin in one step (no
 * review gate — the person running this action IS the verification step).
 *
 * The returned login code and temp password are shown once and stored nowhere.
 * Neither is retrievable afterward; the only recovery is
 * `poResetHrAdminPassword` below, which issues a fresh temp password.
 */
export async function poCreateCompany(input: CreateCompanyInput): Promise<CreateCompanyResult> {
  return callPoFunction<CreateCompanyResult>(
    'waa-platform-owner-create-company',
    { ...input },
    'Could not create that company.'
  );
}

/* ------------------------------------------- Reset HR/Admin password --- */

/**
 * Issues a new temp password for one HR/Admin and re-arms their forced reset.
 * The login code comes back too — it does not change, it is echoed so the
 * whole credential pair can be relayed in one go.
 */
export async function poResetHrAdminPassword(
  hrAdminId: string
): Promise<ResetHrAdminPasswordResult> {
  return callPoFunction<ResetHrAdminPasswordResult>(
    'waa-platform-owner-reset-hr-admin-password',
    { hr_admin_id: hrAdminId },
    'Could not reset that password.'
  );
}

/* --------------------------------------------- Suspend / reactivate --- */

/**
 * Suspension is checked at login (`waa-resolve-login`), not mid-session — an
 * already-issued JWT stays valid until it naturally expires, so suspending a
 * company does not retroactively kill sessions already signed in.
 */
export async function poToggleCompanyActive(companyId: string, active: boolean): Promise<void> {
  await callPoFunction<{ ok: true }>(
    'waa-platform-owner-toggle-company-active',
    { company_id: companyId, active },
    'Could not change that company’s status.'
  );
}

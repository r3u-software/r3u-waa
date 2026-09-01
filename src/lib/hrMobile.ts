import { supabase } from './supabase';

/**
 * HR/Admin's entire mobile data surface.
 *
 * Per HR-ADMIN-MOBILE-ACCESS-ADDENDUM.md (resolved as Option A in
 * ADDENDA-PROPOSAL.md), HR/Admin has **no direct table grants left** on
 * `waa_payslips`, `waa_worker_pay`, `waa_payroll_runs`, `waa_payroll_settings`,
 * `waa_cash_advance_money`, `waa_workers`, `waa_supervisors` and the rest of
 * the payroll tables. Everything an HR/Admin phone can read or write goes
 * through one of the three narrow edge functions below, each of which enforces
 * its own scope server-side with the service role.
 *
 * That is the whole point: a lost or stolen HR/Admin phone has no broad table
 * to fall back on through the API, not merely a UI that hides it. So do not add
 * `supabase.from('waa_…')` calls for HR/Admin anywhere — they will be denied by
 * RLS, and if they ever aren't, that's the security bar slipping.
 */

type Json = Record<string, unknown>;

/**
 * Invokes one of the HR mobile functions and unwraps its error body. The
 * functions answer with `{ error: string }` on a non-2xx, which supabase-js
 * buries inside `FunctionsHttpError.context` — surfaced here so screens can
 * show the real reason (including verbatim Postgres trigger messages, e.g. the
 * `waa_car_require_proof` gate) instead of "non-2xx status code".
 */
async function callHrFunction<T>(slug: string, body: Json, fallback: string): Promise<T> {
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

/* ------------------------------------------------- Cash advances --- */

const CASH_ADVANCES_FN = 'waa-hr-mobile-cash-advances';

export interface HrPendingCashAdvance {
  id: string;
  worker_name: string;
  /** Null only if the money row is somehow missing; render a placeholder. */
  amount: number | null;
  reason: string | null;
  created_at: string;
}

export interface HrAwaitingPayoutCashAdvance {
  id: string;
  worker_name: string;
  amount: number | null;
}

export async function hrListPendingCashAdvances(): Promise<HrPendingCashAdvance[]> {
  const res = await callHrFunction<{ items: HrPendingCashAdvance[] }>(
    CASH_ADVANCES_FN,
    { action: 'list_pending' },
    'Could not load pending cash advances.'
  );
  return res.items ?? [];
}

export async function hrDecideCashAdvanceMobile(
  cashAdvanceId: string,
  decision: 'approved' | 'declined',
  remarks?: string
): Promise<void> {
  await callHrFunction<{ ok: true }>(
    CASH_ADVANCES_FN,
    { action: 'decide', cash_advance_id: cashAdvanceId, decision, remarks: remarks ?? null },
    'Could not record that decision.'
  );
}

export async function hrListCashAdvancesAwaitingPayout(): Promise<HrAwaitingPayoutCashAdvance[]> {
  const res = await callHrFunction<{ items: HrAwaitingPayoutCashAdvance[] }>(
    CASH_ADVANCES_FN,
    { action: 'list_awaiting_payout' },
    'Could not load advances awaiting payout.'
  );
  return res.items ?? [];
}

/** The proof must already be uploaded — the DB trigger rejects the flip otherwise. */
export async function hrMarkCashAdvancePaidOut(
  cashAdvanceId: string,
  proofUrl: string
): Promise<void> {
  await callHrFunction<{ ok: true }>(
    CASH_ADVANCES_FN,
    { action: 'mark_paid_out', cash_advance_id: cashAdvanceId, proof_url: proofUrl },
    'Could not mark that advance paid out.'
  );
}

/* --------------------------------------------------- Separations --- */

const SEPARATIONS_FN = 'waa-hr-mobile-separations';

export interface HrSeparationNote {
  note: string;
  decided_at: string;
}

export interface HrSeparationCase {
  worker_id: string;
  full_name: string;
  employment_status: string;
  tagged_at: string | null;
  tagged_by_supervisor: string | null;
  pending_cash_advances: number;
  unfinalized_payslips: number;
  prior_notes: HrSeparationNote[];
}

export async function hrListSeparationCases(): Promise<HrSeparationCase[]> {
  const res = await callHrFunction<{ items: HrSeparationCase[] }>(
    SEPARATIONS_FN,
    { action: 'list' },
    'Could not load separation cases.'
  );
  return res.items ?? [];
}

/**
 * Records a decision as a note. It deliberately changes no pay data — the
 * addendum is explicit that what happens to a separated worker's pending pay
 * stays a manual judgment call, never an automated consequence of this write.
 */
export async function hrDecideSeparation(workerId: string, note: string): Promise<void> {
  await callHrFunction<{ ok: true }>(
    SEPARATIONS_FN,
    { action: 'decide', worker_id: workerId, note },
    'Could not record that note.'
  );
}

/* ----------------------------------------------- Payslip proofs --- */

const PAYSLIP_PROOFS_FN = 'waa-hr-mobile-payslip-proofs';

export interface HrPendingPayslipProof {
  payslip_id: string;
  payroll_run_id: string;
  worker_id: string;
  period_start: string;
  period_end: string;
  worker_name: string;
  net_pay: number;
}

export async function hrListPayslipsMissingProof(): Promise<HrPendingPayslipProof[]> {
  const res = await callHrFunction<{ items: HrPendingPayslipProof[] }>(
    PAYSLIP_PROOFS_FN,
    { action: 'list_pending' },
    'Could not load payslips awaiting proof.'
  );
  return res.items ?? [];
}

/**
 * Attaches proof to one payslip. `run_marked_paid` comes back true when this
 * was the last payslip on its run still missing proof — the function completes
 * the run itself, so mobile never needs a separate "mark run paid" control.
 */
export async function hrAttachPayslipProof(
  payslipId: string,
  proofUrl: string
): Promise<{ run_marked_paid: boolean }> {
  const res = await callHrFunction<{ ok: true; run_marked_paid: boolean }>(
    PAYSLIP_PROOFS_FN,
    { action: 'attach_proof', payslip_id: payslipId, proof_url: proofUrl },
    'Could not attach that proof.'
  );
  return { run_marked_paid: !!res.run_marked_paid };
}

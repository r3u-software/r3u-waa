import { supabase } from './supabase';
import type {
  EmploymentStatus,
  GeneratePayrollRunResult,
  PayrollRunStatus,
  RegisterSupervisorResult,
  RegisterWorkerResult,
  WaaAssignmentWithProject,
  WaaCashAdvance,
  WaaCashAdvanceDetailed,
  WaaCashAdvanceWithMoney,
  WaaDeductionType,
  WaaLeaveRequest,
  WaaLeaveRequestDetailed,
  WaaPayrollRun,
  WaaPayrollSettings,
  WaaPayslip,
  WaaPayslipDetailed,
  WaaProject,
  WaaSupervisor,
  WaaTimeEntry,
  WaaTimeEntryDetailed,
  WaaWorker,
  WaaWorkerDeduction,
  WaaWorkerLeavePay,
  WaaWorkerLeavePayType,
  WaaWorkerPay,
} from './types';

/**
 * Every query here runs as the signed-in user. Row Level Security decides what
 * comes back — workers see only their own rows, supervisors see rows for the
 * workers whose `supervisor_id` is their own. There is deliberately no
 * client-side authorization logic layered on top.
 */

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

/* =============================================================== WORKER === */

/** Sites this worker may punch against, primary first. */
export async function fetchWorkerAssignments(workerId: string): Promise<WaaAssignmentWithProject[]> {
  const res = await supabase
    .from('waa_worker_project_assignments')
    .select('*, project:waa_projects(*)')
    .eq('worker_id', workerId)
    .order('is_primary', { ascending: false });
  return unwrap<WaaAssignmentWithProject[]>(res as never);
}

export async function fetchWorkerTimeEntries(
  workerId: string,
  limit = 50
): Promise<WaaTimeEntryDetailed[]> {
  const res = await supabase
    .from('waa_time_entries')
    .select('*, project:waa_projects(*)')
    .eq('worker_id', workerId)
    .order('entry_timestamp', { ascending: false })
    .limit(limit);
  return unwrap<WaaTimeEntryDetailed[]>(res as never);
}

/**
 * A worker's own advances, with the money row joined in.
 *
 * The peso figure lives in `waa_cash_advance_money`, a separate table whose
 * only non-HR policy is "the worker this advance belongs to". Supervisors get
 * nothing back from that join, by design — see `fetchWorkerCashAdvanceRequests`
 * for the supervisor-side, amount-free variant.
 */
export async function fetchWorkerCashAdvances(
  workerId: string
): Promise<WaaCashAdvanceWithMoney[]> {
  const res = await supabase
    .from('waa_cash_advance_requests')
    .select('*, money:waa_cash_advance_money(*)')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  return unwrap<WaaCashAdvanceWithMoney[]>(res as never);
}

/**
 * The request rows only — no money join. Used anywhere a supervisor is the
 * caller, since they have no grant on `waa_cash_advance_money` at all.
 */
export async function fetchWorkerCashAdvanceRequests(
  workerId: string
): Promise<WaaCashAdvance[]> {
  const res = await supabase
    .from('waa_cash_advance_requests')
    .select('id, worker_id, reason, status, created_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  return unwrap<WaaCashAdvance[]>(res as never);
}

export async function fetchWorkerLeaveRequests(workerId: string): Promise<WaaLeaveRequest[]> {
  const res = await supabase
    .from('waa_leave_requests')
    .select('*')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  return unwrap<WaaLeaveRequest[]>(res as never);
}

/**
 * Records a punch. Always lands as `pending` — the DB default.
 *
 * `company_id` is required here even though `worker_id` alone identifies the
 * worker unambiguously: `waa_time_entries_insert_own`'s RLS `WITH CHECK` is
 * `company_id = waa_current_company_id() AND worker_id = waa_current_worker_id()`,
 * and the column is `NOT NULL` with no default and no populating trigger. Omit
 * it and Postgres tries to insert NULL for it, which makes that AND evaluate
 * to NULL (not true) under three-valued logic — the insert is rejected as an
 * RLS violation rather than the (more honest) not-null violation it actually
 * is. Found live: every punch was failing this way after `company_id` was
 * added to this table in the multi-tenant retrofit, because this call site
 * was never updated to send it.
 */
export async function insertTimeEntry(input: {
  worker_id: string;
  company_id: string;
  project_id: string;
  type: 'in' | 'out';
  selfie_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
}): Promise<WaaTimeEntry> {
  const res = await supabase.from('waa_time_entries').insert(input).select().single();
  if (res.error) throw new Error(res.error.message);
  return res.data as WaaTimeEntry;
}

/**
 * Submitting an advance now goes through a SECURITY DEFINER RPC, because the
 * request row and its amount live in two tables and the worker can only insert
 * into one of them. The function writes both atomically and returns the new
 * request id.
 */
export async function submitCashAdvance(amount: number, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc('waa_submit_cash_advance', {
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/*
 * NOTE — worker-uploaded advance receipts are currently not writable.
 * `receipt_url` moved from `waa_cash_advance_requests` onto
 * `waa_cash_advance_money`, and that table's only worker-facing policy is
 * SELECT (`waa_cam_select_own`). There is no worker UPDATE grant, so the
 * receipt-attach control that existed before this module has been removed
 * from the worker's cash-advance screen rather than left to fail at runtime.
 * Re-adding it needs a backend change (a narrow worker UPDATE policy on
 * `receipt_url`, or an RPC), which is out of scope for this app-side work.
 */

/** Same missing-`company_id` bug as `insertTimeEntry` above, and same fix —
 * `waa_lr_insert_own`'s RLS WITH CHECK needs it, the column is NOT NULL with
 * no default, and this call site never sent it. */
export async function submitLeaveRequest(input: {
  worker_id: string;
  company_id: string;
  leave_type: string;
  date_from: string;
  date_to: string;
  reason: string;
}) {
  const res = await supabase.from('waa_leave_requests').insert(input).select().single();
  if (res.error) throw new Error(res.error.message);
  return res.data as WaaLeaveRequest;
}

/**
 * Worker self-service profile edit. The worker may correct the name/phone the
 * supervisor typed, and set their own face scan / valid ID.
 *
 * `status` flips to 'complete' only once BOTH the face scan and the valid ID
 * are on file — matching the brief's rule that the flag is derived, never
 * set by hand.
 */
export async function updateWorkerProfile(
  workerId: string,
  patch: Partial<Pick<WaaWorker, 'full_name' | 'phone' | 'face_scan_url' | 'valid_id_url'>>,
  current: WaaWorker
): Promise<WaaWorker> {
  const merged = { ...current, ...patch };
  const complete = Boolean(merged.face_scan_url && merged.valid_id_url);

  const res = await supabase
    .from('waa_workers')
    .update({ ...patch, status: complete ? 'complete' : 'incomplete' })
    .eq('id', workerId)
    .select()
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data as WaaWorker;
}

/*
 * `fetchCutoffSummary` used to live here — a read-only punch summary for the
 * placeholder Pay tab. The real Pay tab computes its own running estimate now
 * (it needs the settings row and the rate as well as the punches), so this was
 * removed rather than left as a second, divergent path to the same numbers.
 */

/* ------------------------------------------------- Worker: payroll view --- */

/**
 * The org-wide singleton settings row. Every authenticated role may read it
 * (`waa_payroll_settings_select_authenticated`), which is what lets the worker
 * compute a client-side estimate against the real overtime rate and standard
 * day length rather than guessing.
 */
/**
 * Pre-existing bug fixed here, found live: this filtered on `is_singleton`,
 * a column that does not exist in the deployed schema at all (confirmed
 * against information_schema — not a typo introduced this phase, just never
 * caught because every caller of this function was itself unreachable until
 * now). Every request to `waa_payroll_settings` 400'd with `42703 column
 * waa_payroll_settings.is_singleton does not exist`, silently, since no
 * caller checked the response status closely enough to notice before this.
 * RLS's own `waa_payroll_settings_select_own_company` policy already scopes
 * this to exactly the caller's own company's one row — no filter needed.
 */
export async function fetchPayrollSettings(): Promise<WaaPayrollSettings | null> {
  const res = await supabase.from('waa_payroll_settings').select('*').maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data as WaaPayrollSettings | null;
}

/** A worker's own rate. Returns null when HR/Admin hasn't set one yet. */
export async function fetchMyHourlyRate(workerId: string): Promise<number | null> {
  const res = await supabase
    .from('waa_worker_pay')
    .select('hourly_rate')
    .eq('worker_id', workerId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  const rate = (res.data as { hourly_rate: number | null } | null)?.hourly_rate;
  return rate == null ? null : Number(rate);
}

/**
 * Payslips a worker may see — i.e. from runs that actually reached `paid`.
 *
 * Filtering on the parent run's status is not possible from the worker's
 * token: they have SELECT on `waa_payslips` (own rows only) but no policy at
 * all on `waa_payroll_runs`, so an embedded `!inner` join would silently match
 * nothing. `paid_at` on the payslip itself is the worker-visible marker
 * instead — it is stamped by `markPayrollRunPaid` right after the run's
 * status transition is accepted by the DB.
 */
export async function fetchMyPayslips(workerId: string): Promise<WaaPayslip[]> {
  const res = await supabase
    .from('waa_payslips')
    .select('*')
    .eq('worker_id', workerId)
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false });
  return unwrap<WaaPayslip[]>(res as never);
}

/** Approved leave overlapping the current cutoff, for the running estimate. */
export async function fetchLeaveInWindow(
  workerId: string,
  periodStart: string,
  periodEnd: string
): Promise<WaaLeaveRequest[]> {
  const res = await supabase
    .from('waa_leave_requests')
    .select('*')
    .eq('worker_id', workerId)
    .eq('status', 'approved')
    .lte('date_from', periodEnd)
    .gte('date_to', periodStart);
  return unwrap<WaaLeaveRequest[]>(res as never);
}

/* =========================================================== SUPERVISOR === */

export async function fetchProjects(): Promise<WaaProject[]> {
  const res = await supabase.from('waa_projects').select('*').order('name');
  return unwrap<WaaProject[]>(res as never);
}

/**
 * Roster — RLS already scopes this to the calling supervisor's workers, and
 * the `employment_status` filter is what makes a separated worker disappear
 * from the supervisor's view the moment they're tagged. That's deliberately a
 * query-level filter, not an RLS lockout: the row itself stays readable so
 * historical punches and approvals don't break, and HR/Admin keeps full sight
 * of the worker for the manual separation-pay decision.
 */
export async function fetchRoster(): Promise<WaaWorker[]> {
  const res = await supabase
    .from('waa_workers')
    .select('*')
    .eq('employment_status', 'active')
    .order('full_name');
  return unwrap<WaaWorker[]>(res as never);
}

/**
 * Supervisor's own worker-detail screen calls this too, and Supervisor has
 * a real RLS policy for their own workers (`waa_workers_select_by_supervisor`)
 * -- left as a direct table read for that caller. HR/Admin has no such
 * policy at all, so `app/(hr)/worker/[id].tsx` uses `fetchWorkerByIdForHr`
 * below instead, not this function.
 */
export async function fetchWorkerById(workerId: string): Promise<WaaWorker | null> {
  const res = await supabase.from('waa_workers').select('*').eq('id', workerId).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data as WaaWorker | null;
}

/** HR/Admin-only counterpart to `fetchWorkerById` above -- see that comment. */
export async function fetchWorkerByIdForHr(workerId: string): Promise<WaaWorker | null> {
  const res = await callHrFn<{ item: WaaWorker | null }>(
    'waa-hr-worker-detail',
    { action: 'get_worker', worker_id: workerId },
    'Could not load that worker.'
  );
  return res.item;
}

export async function fetchPendingTimeEntries(): Promise<WaaTimeEntryDetailed[]> {
  const res = await supabase
    .from('waa_time_entries')
    .select('*, project:waa_projects(*), worker:waa_workers(id, full_name)')
    .eq('status', 'pending')
    .order('entry_timestamp', { ascending: false });
  return unwrap<WaaTimeEntryDetailed[]>(res as never);
}

/**
 * Open cash advance requests, WITHOUT the money row.
 *
 * The supervisor no longer decides these — approval moved to HR/Admin — so
 * this exists only so the Approvals tab can say "a request is outstanding".
 * Deliberately selects named columns rather than `*`: there must be no route
 * by which a peso figure reaches a supervisor's client.
 */
export async function fetchPendingCashAdvances(): Promise<WaaCashAdvanceDetailed[]> {
  const res = await supabase
    .from('waa_cash_advance_requests')
    .select('id, worker_id, reason, status, created_at, worker:waa_workers(id, full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return unwrap<WaaCashAdvanceDetailed[]>(res as never);
}

/* ------------------------------------------------- Supervisor: Team tab --- */

/** One row of the supervisor's Team grid. Hours and days only — never pesos. */
export interface TeamRow {
  worker: WaaWorker;
  days: number;
  hours: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  flagged: boolean;
  /** The leave requests that caused the flag, so the supervisor can go fix them. */
  overlapping: WaaLeaveRequest[];
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Inclusive day count of a leave range, clipped to the cutoff window. */
function clippedLeaveDays(
  from: string,
  to: string,
  periodStart: string,
  periodEnd: string
): number {
  const start = from > periodStart ? from : periodStart;
  const end = to < periodEnd ? to : periodEnd;
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  if (endMs < startMs) return 0;
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

/** Pairs of leave requests on the same worker whose date ranges overlap. */
function findOverlaps(leaves: WaaLeaveRequest[]): WaaLeaveRequest[] {
  const open = leaves.filter((l) => l.status === 'pending' || l.status === 'approved');
  const hit = new Set<string>();
  for (let i = 0; i < open.length; i += 1) {
    for (let j = i + 1; j < open.length; j += 1) {
      if (open[i].date_from <= open[j].date_to && open[j].date_from <= open[i].date_to) {
        hit.add(open[i].id);
        hit.add(open[j].id);
      }
    }
  }
  return open.filter((l) => hit.has(l.id));
}

/**
 * The supervisor's own team, with the same raw inputs the payroll engine
 * reads — worked days/hours from approved punches, leave days from approved
 * leave — and the leave-overlap flag.
 *
 * Everything here comes from `waa_time_entries` / `waa_leave_requests` /
 * `waa_workers`, the three tables a supervisor already had access to before
 * payroll existed. No money-bearing table is touched, so there is genuinely
 * no pay figure to render, hide, or leak.
 *
 * "Paid leave (days)" cannot be resolved on this side either — the leave-pay
 * master switch lives in `waa_worker_leave_pay`, which supervisors have no
 * grant on. Every approved leave day is therefore reported under
 * `unpaidLeaveDays`, and the screen labels the paid column as unavailable
 * rather than guessing.
 */
export async function fetchTeamRows(periodStart: string, periodEnd: string): Promise<TeamRow[]> {
  const roster = await fetchRoster();
  if (roster.length === 0) return [];

  const ids = roster.map((w) => w.id);

  const [entriesRes, leavesRes] = await Promise.all([
    supabase
      .from('waa_time_entries')
      .select('worker_id, type, entry_timestamp')
      .in('worker_id', ids)
      .eq('status', 'approved')
      .gte('entry_timestamp', `${periodStart}T00:00:00Z`)
      .lte('entry_timestamp', `${periodEnd}T23:59:59Z`)
      .order('entry_timestamp', { ascending: true }),
    supabase.from('waa_leave_requests').select('*').in('worker_id', ids),
  ]);
  if (entriesRes.error) throw new Error(entriesRes.error.message);
  if (leavesRes.error) throw new Error(leavesRes.error.message);

  type Punch = { worker_id: string; type: 'in' | 'out'; entry_timestamp: string };
  const punches = (entriesRes.data ?? []) as Punch[];
  const leaves = (leavesRes.data ?? []) as WaaLeaveRequest[];

  return roster.map((worker) => {
    // Pair each day's first 'in' with its last 'out' — the same rule
    // waa-generate-payroll-run uses, so the numbers reconcile.
    const byDay = new Map<string, { in?: string; out?: string }>();
    for (const p of punches) {
      if (p.worker_id !== worker.id) continue;
      const key = dayKey(p.entry_timestamp);
      const slot = byDay.get(key) ?? {};
      if (p.type === 'in' && !slot.in) slot.in = p.entry_timestamp;
      if (p.type === 'out') slot.out = p.entry_timestamp;
      byDay.set(key, slot);
    }

    let hours = 0;
    let days = 0;
    for (const slot of byDay.values()) {
      if (!slot.in || !slot.out) continue;
      days += 1;
      hours += Math.max(
        0,
        (new Date(slot.out).getTime() - new Date(slot.in).getTime()) / 3_600_000
      );
    }

    const mine = leaves.filter((l) => l.worker_id === worker.id);
    const unpaidLeaveDays = mine
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + clippedLeaveDays(l.date_from, l.date_to, periodStart, periodEnd), 0);
    const overlapping = findOverlaps(mine);

    return {
      worker,
      days,
      hours: Math.round(hours * 100) / 100,
      paidLeaveDays: 0,
      unpaidLeaveDays,
      flagged: overlapping.length > 0,
      overlapping,
    };
  });
}

/**
 * The authoritative flag, straight from the same SECURITY DEFINER function the
 * `draft -> reviewed` trigger calls. Used to confirm the client-side overlap
 * computation above agrees with what will actually gate the payroll run.
 *
 * Calls the `_for_caller` wrapper, not `waa_worker_has_leave_overlap` itself —
 * the bare function has no caller/company check at all (it's meant for the
 * trigger's own internal use, where that check doesn't apply) and client
 * EXECUTE on it was revoked for exactly that reason. The wrapper resolves to
 * `false` for a worker outside the caller's own company rather than leaking
 * whether that worker exists.
 */
export async function fetchWorkerLeaveOverlapFlag(workerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('waa_worker_has_leave_overlap_for_caller', {
    p_worker_id: workerId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * Tags a separation. Only ever succeeds for a worker whose `supervisor_id` is
 * the caller's own — that's the pre-existing `waa_workers_update_by_supervisor`
 * policy, not a new grant. The worker drops out of `fetchRoster` / the Team tab
 * on the next fetch; their payroll history is untouched.
 */
export async function setEmploymentStatus(
  workerId: string,
  status: EmploymentStatus,
  supervisorId: string
) {
  const res = await supabase
    .from('waa_workers')
    .update({
      employment_status: status,
      employment_status_set_by: supervisorId,
      employment_status_set_at: new Date().toISOString(),
    })
    .eq('id', workerId);
  if (res.error) throw new Error(res.error.message);
}

export async function fetchPendingLeaveRequests(): Promise<WaaLeaveRequestDetailed[]> {
  const res = await supabase
    .from('waa_leave_requests')
    .select('*, worker:waa_workers(id, full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return unwrap<WaaLeaveRequestDetailed[]>(res as never);
}

/** Today's approved/pending punches, for the "present today" counter. */
export async function fetchTodaysEntries(): Promise<WaaTimeEntryDetailed[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const res = await supabase
    .from('waa_time_entries')
    .select('*, project:waa_projects(*), worker:waa_workers(id, full_name)')
    .gte('entry_timestamp', start.toISOString())
    .order('entry_timestamp', { ascending: false });
  return unwrap<WaaTimeEntryDetailed[]>(res as never);
}

type Decision = 'approved' | 'declined';

export async function decideTimeEntry(id: string, decision: Decision, supervisorId: string) {
  const res = await supabase
    .from('waa_time_entries')
    .update({ status: decision, approved_by: supervisorId, approved_at: new Date().toISOString() })
    .eq('id', id);
  if (res.error) throw new Error(res.error.message);
}

/*
 * `decideCashAdvance` used to live here. Cash advance approval belongs to
 * HR/Admin now — see `hrDecideCashAdvance` in the HR/ADMIN section below.
 * The supervisor has neither the UI action nor the RLS grant for it.
 */

export async function decideLeaveRequest(
  id: string,
  decision: Decision,
  supervisorId: string,
  remarks?: string
) {
  const res = await supabase
    .from('waa_leave_requests')
    .update({
      status: decision,
      approved_by: supervisorId,
      approved_at: new Date().toISOString(),
      decline_remarks: decision === 'declined' ? remarks || null : null,
    })
    .eq('id', id);
  if (res.error) throw new Error(res.error.message);
}

/** Supervisor-only: attach a signed contract PDF to a worker. */
export async function setWorkerContract(workerId: string, contractPath: string) {
  const res = await supabase
    .from('waa_workers')
    .update({ contract_pdf_url: contractPath })
    .eq('id', workerId);
  if (res.error) throw new Error(res.error.message);
}

/**
 * The ONLY supported way to create a worker. The edge function runs with the
 * service-role key server-side: it creates the Auth account, generates the
 * temp password, and inserts the worker + primary assignment rows.
 * The returned credentials are shown once and are not retrievable afterward.
 */
export async function registerWorker(input: {
  full_name: string;
  phone: string;
  project_id: string;
}): Promise<RegisterWorkerResult> {
  const { data, error } = await supabase.functions.invoke('waa-register-worker', {
    body: input,
  });
  if (error) throw new Error(await edgeErrorMessage(error, 'Registration failed.'));
  return data as RegisterWorkerResult;
}

/**
 * Edge function errors put the useful detail in the response body rather than
 * `error.message`. `FunctionsHttpError` exposes it as a `Response`; older
 * shapes hand back a plain string. Both are unwrapped here so the caller can
 * surface the real reason ("Run is already 'finalized'…") instead of
 * "Edge Function returned a non-2xx status code".
 */
async function edgeErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: unknown }).context;

  if (ctx instanceof Response) {
    try {
      const body = await ctx.clone().json();
      if (body && typeof body.error === 'string') return body.error;
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text) return text;
      } catch {
        /* fall through to the generic message */
      }
    }
  }

  const legacyBody = (ctx as { body?: unknown } | undefined)?.body;
  if (typeof legacyBody === 'string' && legacyBody) return legacyBody;

  const message = (error as { message?: string }).message;
  return message || fallback;
}

/**
 * Shared invoker for the HR full-dashboard edge functions
 * (`waa-hr-roster`, `waa-hr-payroll-grid`, `waa-hr-settings`,
 * `waa-hr-worker-detail`, and `waa-hr-mobile-cash-advances`'s `list_all`) —
 * HR-DASHBOARD-RELOCATION-PROPOSAL.md. Every exported function below that
 * calls one of these keeps its original signature and return shape exactly,
 * so the 6 screens that call them did not need to change at all — only the
 * transport underneath did.
 */
async function callHrFn<T>(
  fnName: string,
  body: Record<string, unknown>,
  fallback: string
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw new Error(await edgeErrorMessage(error, fallback));
  return data as T;
}

/* ============================================================= HR/ADMIN === */

/**
 * Every query below runs as an HR/Admin. Their policies are unscoped
 * (`waa_current_hr_admin_id() is not null`), so these deliberately carry no
 * client-side filtering beyond what the screen is actually asking for.
 */

/** Every worker, separated ones included — HR/Admin sees the whole picture. */
export async function fetchAllWorkers(): Promise<WaaWorker[]> {
  const res = await callHrFn<{ items: WaaWorker[] }>(
    'waa-hr-roster',
    { action: 'list_workers' },
    'Could not load the worker list.'
  );
  return res.items;
}

/**
 * Supervisors, for the HR/Admin roster.
 *
 * `waa_supervisors` has only a `select_own` policy (Supervisor's own row) --
 * no HR/Admin SELECT grant exists, verified against pg_policies before
 * `waa-hr-roster` was built. Routed through that function now instead of
 * the direct-table call that used to come back empty for HR/Admin.
 */
export async function fetchSupervisors(): Promise<WaaSupervisor[]> {
  const res = await callHrFn<{ items: WaaSupervisor[] }>(
    'waa-hr-roster',
    { action: 'list_supervisors' },
    'Could not load the supervisor list.'
  );
  return res.items;
}

export async function fetchPayrollRuns(): Promise<WaaPayrollRun[]> {
  const res = await callHrFn<{ items: WaaPayrollRun[] }>(
    'waa-hr-payroll-grid',
    { action: 'list_runs' },
    'Could not load payroll runs.'
  );
  return res.items;
}

export async function fetchPayslipsForRun(runId: string): Promise<WaaPayslipDetailed[]> {
  const res = await callHrFn<{ items: WaaPayslipDetailed[] }>(
    'waa-hr-payroll-grid',
    { action: 'list_payslips_for_run', run_id: runId },
    'Could not load payslips for that run.'
  );
  return res.items;
}

/**
 * Computes (or recomputes) a draft run. Safe to re-invoke while the run is
 * still `draft` — the function releases the cash advances it had tentatively
 * claimed, wipes the payslips, and recomputes from scratch.
 */
export async function generatePayrollRun(
  periodStart: string,
  periodEnd: string
): Promise<GeneratePayrollRunResult> {
  const { data, error } = await supabase.functions.invoke('waa-generate-payroll-run', {
    body: { period_start: periodStart, period_end: periodEnd },
  });
  if (error) throw new Error(await edgeErrorMessage(error, 'Could not generate the run.'));
  return data as GeneratePayrollRunResult;
}

/**
 * Advances a run's status with a plain UPDATE. The gates are DB triggers, so
 * a blocked transition comes back as a Postgres exception whose message is
 * written to be read by a human — callers surface `error.message` verbatim
 * rather than replacing it with something generic.
 */
export async function setPayrollRunStatus(runId: string, status: PayrollRunStatus) {
  // The screen only ever calls this with 'reviewed' or 'finalized' -- a
  // 'paid' transition always goes through markPayrollRunPaid below instead,
  // which the edge function's separate mark_paid action mirrors.
  await callHrFn(
    'waa-hr-payroll-grid',
    { action: 'advance_status', run_id: runId, status },
    'Could not change the run status.'
  );
}

/**
 * Marks a run paid, then stamps `paid_at` on its payslips.
 *
 * Order matters: the `waa_require_proof_before_paid` trigger rejects the run
 * update unless every payslip already has a `proof_url`, so the run
 * transition is attempted first and the payslip stamp only happens once the
 * database has accepted it. That stamp is what makes the slip visible on the
 * worker's Pay tab — workers have no policy on `waa_payroll_runs` and so
 * cannot filter on the run's own status.
 */
export async function markPayrollRunPaid(runId: string) {
  // The edge function's mark_paid action does both steps atomically
  // server-side (status -> paid, then paid_at stamped on every payslip) --
  // same order/behavior as before, just no longer two separate client calls.
  await callHrFn(
    'waa-hr-payroll-grid',
    { action: 'mark_paid', run_id: runId },
    'Could not mark the run as paid.'
  );
}

/** Writes an uploaded proof path onto one worker's payslip. */
export async function attachPayslipProof(payslipId: string, proofPath: string) {
  await callHrFn(
    'waa-hr-payroll-grid',
    { action: 'attach_proof', payslip_id: payslipId, proof_path: proofPath },
    'Could not attach the proof.'
  );
}

/* ------------------------------------------- HR/Admin: cash advances --- */

export async function fetchAllCashAdvances(): Promise<WaaCashAdvanceDetailed[]> {
  const res = await callHrFn<{ items: WaaCashAdvanceDetailed[] }>(
    'waa-hr-mobile-cash-advances',
    { action: 'list_all' },
    'Could not load cash advances.'
  );
  return res.items;
}

/**
 * Approve or decline an advance. Reuses the same `decide` action the
 * emergency-mobile cash-advance screen already calls (`waa-hr-mobile-cash-advances`)
 * rather than a duplicate function -- per HR-DASHBOARD-RELOCATION-PROPOSAL.md,
 * that logic is already company-scoped and already live-tested.
 */
export async function hrDecideCashAdvance(
  requestId: string,
  decision: Decision,
  hrAdminId: string,
  remarks?: string
) {
  void hrAdminId; // the edge function derives the actor from the caller's own session
  await callHrFn(
    'waa-hr-mobile-cash-advances',
    { action: 'decide', cash_advance_id: requestId, decision, remarks },
    'Could not save that decision.'
  );
}

/**
 * Records the proof of an actual disbursement, then flips the request to
 * `paid_out` -- both steps the mobile function's `mark_paid_out` action
 * already does atomically, in the same order the DB trigger
 * (`waa_car_require_proof`) requires. `markCashAdvancePaidOut` below is kept
 * as a real export (the screen still calls both in sequence) but the actual
 * work all happens here; its own call is a harmless no-op re-request of the
 * same already-completed state.
 */
export async function attachCashAdvanceProof(requestId: string, proofPath: string) {
  await callHrFn(
    'waa-hr-mobile-cash-advances',
    { action: 'mark_paid_out', cash_advance_id: requestId, proof_url: proofPath },
    'Could not attach the proof.'
  );
}

/**
 * The screen calls this immediately after `attachCashAdvanceProof` above,
 * which already completed the full paid_out flip via the shared
 * `mark_paid_out` action -- there is nothing left for this call to do.
 * Deliberately a no-op rather than re-fetching `proof_url` to resend it:
 * HR/Admin has no SELECT policy on `waa_cash_advance_money` (verified, same
 * gap this whole build is fixing), so a direct read here would silently
 * come back empty and this would fail right after the real work succeeded.
 * Kept as a real export only so the screen's existing two-call sequence
 * doesn't need to change.
 */
export async function markCashAdvancePaidOut(_requestId: string) {
  void _requestId;
}

/* ------------------------------------------------ HR/Admin: settings --- */

export async function updatePayrollSettings(
  settingsId: string,
  patch: Partial<
    Pick<
      WaaPayrollSettings,
      | 'cutoff_type'
      | 'overtime_rate_ordinary'
      | 'overtime_rate_restday_holiday'
      | 'standard_hours_per_day'
    >
  >,
  hrAdminId: string
) {
  void hrAdminId; // the edge function derives set_by from the caller's own session
  await callHrFn(
    'waa-hr-settings',
    { action: 'update_settings', settings_id: settingsId, patch },
    'Could not save the settings.'
  );
}

/**
 * `waa_deduction_types` has RLS enabled with zero policies at all (verified
 * against pg_policies -- fully closed to every non-service-role caller, not
 * just missing an HR/Admin grant), and it carries its own company_id column
 * (also verified, not assumed from the -- incomplete -- WaaDeductionType TS
 * type, which is missing both company_id and default_amount). Both settings.tsx
 * and worker/[id].tsx call this same function; either function's
 * get_deduction_types action returns the identical company-scoped shape.
 */
export async function fetchDeductionTypes(): Promise<WaaDeductionType[]> {
  const res = await callHrFn<{ items: WaaDeductionType[] }>(
    'waa-hr-settings',
    { action: 'get_deduction_types' },
    'Could not load deduction types.'
  );
  return res.items;
}

/**
 * NOTE: `waa_deduction_types` has a SELECT policy for HR/Admin but no UPDATE
 * policy, so this write is refused by RLS today. The Settings screen renders
 * the org-wide defaults read-only for that reason. Per-worker overrides
 * (`waa_worker_deductions`, which does have a full HR/Admin ALL policy) are
 * fully editable and cover the brief's override requirement.
 */
export async function setDeductionDefault(typeId: string, activeByDefault: boolean) {
  const res = await supabase
    .from('waa_deduction_types')
    .update({ active_by_default: activeByDefault })
    .eq('id', typeId);
  if (res.error) throw new Error(res.error.message);
}

/* --------------------------------------- HR/Admin: per-worker payroll --- */

export async function fetchWorkerPay(workerId: string): Promise<WaaWorkerPay | null> {
  const res = await callHrFn<{ item: WaaWorkerPay | null }>(
    'waa-hr-worker-detail',
    { action: 'get_pay', worker_id: workerId },
    'Could not load pay information.'
  );
  return res.item;
}

export async function upsertWorkerPay(workerId: string, hourlyRate: number, hrAdminId: string) {
  void hrAdminId; // derived from the caller's own session server-side
  await callHrFn(
    'waa-hr-worker-detail',
    { action: 'save_rate', worker_id: workerId, hourly_rate: hourlyRate },
    'Could not save the rate.'
  );
}

export async function updateWorkerPosition(workerId: string, position: string) {
  await callHrFn(
    'waa-hr-worker-detail',
    { action: 'save_position', worker_id: workerId, position },
    'Could not save the position.'
  );
}

export async function fetchWorkerLeavePay(workerId: string): Promise<WaaWorkerLeavePay | null> {
  const res = await callHrFn<{ item: WaaWorkerLeavePay | null }>(
    'waa-hr-worker-detail',
    { action: 'get_leave_pay', worker_id: workerId },
    'Could not load leave-pay settings.'
  );
  return res.item;
}

/** The master switch. Off means every leave type resolves to unpaid, full stop. */
export async function setLeavePayMaster(
  workerId: string,
  enabled: boolean,
  hrAdminId: string
) {
  void hrAdminId;
  await callHrFn(
    'waa-hr-worker-detail',
    { action: 'set_leave_pay_master', worker_id: workerId, enabled },
    'Could not save that.'
  );
}

export async function fetchWorkerLeavePayTypes(
  workerId: string
): Promise<WaaWorkerLeavePayType[]> {
  const res = await callHrFn<{ items: WaaWorkerLeavePayType[] }>(
    'waa-hr-worker-detail',
    { action: 'get_leave_pay_types', worker_id: workerId },
    'Could not load leave-pay types.'
  );
  return res.items;
}

/** Per-type override. Only consulted while the master switch above is on. */
export async function setLeavePayType(
  workerId: string,
  leaveType: string,
  enabled: boolean,
  hrAdminId: string,
  existingId?: string
) {
  void hrAdminId;
  await callHrFn(
    'waa-hr-worker-detail',
    { action: 'set_leave_pay_type', worker_id: workerId, leave_type: leaveType, enabled, row_id: existingId },
    'Could not save that.'
  );
}

export async function fetchWorkerDeductions(workerId: string): Promise<WaaWorkerDeduction[]> {
  const res = await callHrFn<{ items: WaaWorkerDeduction[] }>(
    'waa-hr-worker-detail',
    { action: 'get_deductions', worker_id: workerId },
    'Could not load deduction overrides.'
  );
  return res.items;
}

/** Per-worker deduction override. Persists across periods — set once, not per run. */
export async function setWorkerDeduction(
  workerId: string,
  deductionTypeId: string,
  enabled: boolean,
  hrAdminId: string,
  existingId?: string
) {
  void hrAdminId;
  await callHrFn(
    'waa-hr-worker-detail',
    { action: 'set_worker_deduction', worker_id: workerId, deduction_type_id: deductionTypeId, enabled, override_id: existingId },
    'Could not save that.'
  );
}

/* ---------------------------------------------------- HR/Admin: sites --- */

/**
 * Site create/edit is one of the few HR/Admin writes that is NOT behind an edge
 * function. `waa_projects` carries real insert/update policies
 * (`waa_projects_insert_by_hr` / `waa_projects_update_by_hr`), both gated on
 * `company_id = waa_current_company_id() and waa_current_hr_admin_id() is not
 * null`. A site's name and location were never part of the Option A pay-figure
 * boundary, so a direct client call is the right shape here — the same shape
 * the worker's own profile edit already uses.
 *
 * Reading the list back is just `fetchProjects()` above: `waa_projects` has a
 * plain company-scoped SELECT policy, so it already returns only this
 * company's sites with no client-side filter.
 */

/**
 * `company_id` is NOT NULL with no DB default, and the insert policy's WITH
 * CHECK compares it against `waa_current_company_id()` — so the client has to
 * supply it and it has to be the caller's own. It comes from the already-loaded
 * HR/Admin session row (`useSession().companyId`); passing anything else is
 * rejected by the policy rather than silently written.
 */
export async function createSite(input: {
  name: string;
  location: string | null;
  company_id: string;
}): Promise<WaaProject> {
  const res = await supabase.from('waa_projects').insert(input).select().single();
  if (res.error) throw new Error(res.error.message);
  return res.data as WaaProject;
}

/**
 * Name/location only. `company_id` is deliberately not updatable from here —
 * moving a site between companies isn't a supported operation, and the update
 * policy would refuse the new value anyway.
 */
export async function updateSite(
  siteId: string,
  patch: { name: string; location: string | null }
): Promise<WaaProject> {
  const res = await supabase
    .from('waa_projects')
    .update(patch)
    .eq('id', siteId)
    .select()
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data as WaaProject;
}

/** Mirrors `registerWorker`: credentials come back once and are not retrievable. */
export async function registerSupervisor(input: {
  full_name: string;
  phone: string;
}): Promise<RegisterSupervisorResult> {
  const { data, error } = await supabase.functions.invoke('waa-register-supervisor', {
    body: input,
  });
  if (error) throw new Error(await edgeErrorMessage(error, 'Registration failed.'));
  return data as RegisterSupervisorResult;
}

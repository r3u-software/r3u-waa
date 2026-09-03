/**
 * Row shapes for the `waa_`-prefixed tables in the shared `r3u-module`
 * Supabase project. These mirror the live schema exactly (verified against
 * information_schema before this file was written).
 *
 * NOTE: the same database also hosts an unrelated, already-live
 * regular-employee HRIS (`employees`, `attendance`, `shifts`, `payslips`, ...).
 * Nothing in this app may read or write those tables.
 */

export type RequestStatus = 'pending' | 'approved' | 'declined';
/** 'pending' sits between the other two: full_name + face_scan_url +
 * valid_id_url are all on file, awaiting the supervisor's approve/reject
 * decision (`reviewWorkerProfile`) — the worker cannot edit any of those
 * three while pending (enforced server-side, not just in the UI). */
export type WorkerStatus = 'incomplete' | 'pending' | 'complete';
export type PunchType = 'in' | 'out';
export type RecipientType = 'worker' | 'supervisor' | 'hr_admin';

/**
 * A cash advance now has its own lifecycle beyond approve/decline:
 * requested -> approved -> paid_out (proof required) -> settled (deducted in a run).
 */
export type CashAdvanceStatus = RequestStatus | 'paid_out' | 'settled';

/** Soft separation flag on a worker profile — never a hard delete. */
export type EmploymentStatus = 'active' | 'terminated' | 'awol' | 'resigned';

export type PayrollRunStatus = 'draft' | 'reviewed' | 'finalized' | 'paid';

export type CutoffType = 'weekly' | 'semi_monthly' | 'monthly';

export interface WaaProject {
  id: string;
  name: string;
  location: string | null;
  created_at: string;
  /** Multi-tenant: NOT NULL, no DB default — an insert must supply it. */
  company_id: string;
}

export interface WaaSupervisor {
  id: string;
  full_name: string;
  phone: string | null;
  auth_user_id: string | null;
  created_at: string;
  /** Forced password reset — true until `waa_complete_password_reset()` runs. */
  must_change_password: boolean;
  company_id: string;
  /** Generated at registration (e.g. `SV-521031`) — this is the "User ID"
   * the login screen actually asks for now, not the phone number below.
   * `phone` stays as a real contact field and a legacy sign-in fallback,
   * never shown as "the login" anywhere in the UI any more. */
  login_code: string;
}

/**
 * The third role table, added with payroll and restructured by the Platform
 * Owner work.
 *
 * HR/Admin no longer logs in with an email address: `login_code` (e.g.
 * `HR-521031`) is its login identifier, assigned once at account creation and
 * never editable — the same pattern `WaaWorker`/`WaaSupervisor` now use too
 * (`WK-`/`SV-` prefixes). `email` is contact/profile data only — never a
 * second way in.
 *
 * `full_name`/`phone`/`email` are all nullable because an HR/Admin account is
 * provisioned by the Platform Owner with nothing but a login code and a temp
 * password. They get filled in by the profile-completion step
 * (`app/complete-profile.tsx`), which is also what flips `profile_complete`.
 */
export interface WaaHrAdmin {
  id: string;
  full_name: string | null;
  phone: string | null;
  auth_user_id: string | null;
  created_at: string;
  must_change_password: boolean;
  company_id: string;
  login_code: string | null;
  email: string | null;
  profile_complete: boolean;
}

/**
 * The fourth role — one account, outside every company boundary, hence no
 * `company_id` and no `must_change_password` (the holder sets their own
 * password directly; there is no temp-password handoff to themselves).
 */
export interface WaaPlatformOwner {
  id: string;
  full_name: string;
  email: string;
  auth_user_id: string | null;
  created_at: string;
}

export interface WaaWorker {
  id: string;
  full_name: string;
  phone: string | null;
  supervisor_id: string | null;
  current_project_id: string | null;
  status: WorkerStatus;
  face_scan_url: string | null;
  valid_id_url: string | null;
  contract_pdf_url: string | null;
  temp_password_issued: boolean;
  auth_user_id: string | null;
  created_at: string;
  /** Payroll module additions. */
  position: string | null;
  employment_status: EmploymentStatus;
  employment_status_set_by: string | null;
  employment_status_set_at: string | null;
  /** Forced password reset — true until `waa_complete_password_reset()` runs. */
  must_change_password: boolean;
  company_id: string;
  /** Generated at registration (e.g. `WK-521031`) — this is the "User ID"
   * the login screen actually asks for now, not the phone number above.
   * `phone` stays as a real contact field and a legacy sign-in fallback,
   * never shown as "the login" anywhere in the UI any more. */
  login_code: string;
  /** Set by `reviewWorkerProfile` on a reject; cleared on the next
   * completed resubmission. Null the rest of the time. */
  profile_rejected_reason: string | null;
  profile_reviewed_at: string | null;
  profile_reviewed_by: string | null;
}

export interface WaaAssignment {
  id: string;
  worker_id: string;
  project_id: string;
  is_primary: boolean;
  created_at: string;
}

/** Assignment joined with its project, as returned by the roster/site queries. */
export interface WaaAssignmentWithProject extends WaaAssignment {
  project: WaaProject | null;
}

export interface WaaTimeEntry {
  id: string;
  worker_id: string;
  project_id: string;
  type: PunchType;
  selfie_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  entry_timestamp: string;
  status: RequestStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface WaaTimeEntryDetailed extends WaaTimeEntry {
  project: WaaProject | null;
  worker: Pick<WaaWorker, 'id' | 'full_name'> | null;
}

/**
 * The cash advance *request*. Deliberately holds no peso figure — the amount
 * and every money-bearing column moved to `waa_cash_advance_money`, which has
 * zero Supervisor RLS policy. That table split is the pay-figure boundary;
 * do not merge these back together.
 */
export interface WaaCashAdvance {
  id: string;
  worker_id: string;
  reason: string | null;
  status: CashAdvanceStatus;
  created_at: string;
}

/** The money half of a cash advance. Readable by HR/Admin, and by its own worker. */
export interface WaaCashAdvanceMoney {
  cash_advance_id: string;
  amount: number;
  decline_remarks: string | null;
  receipt_url: string | null;
  proof_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_out_at: string | null;
  settled_in_payroll_run_id: string | null;
}

/** Request joined with its money row — only ever fetched as a worker or HR/Admin. */
export interface WaaCashAdvanceWithMoney extends WaaCashAdvance {
  money: WaaCashAdvanceMoney | null;
}

export interface WaaCashAdvanceDetailed extends WaaCashAdvanceWithMoney {
  worker: Pick<WaaWorker, 'id' | 'full_name'> | null;
}

/* ------------------------------------------------- Payroll configuration --- */

/**
 * One row per company (post-multi-tenant-retrofit — the "Singleton" in the
 * old comment here predates `company_id` and no longer applies; there is no
 * `is_singleton` column in the deployed schema, confirmed against
 * information_schema after a real, live bug from that stale assumption).
 * Every authenticated role in the company may read their own company's row.
 */
export interface WaaPayrollSettings {
  id: string;
  cutoff_type: CutoffType;
  overtime_rate_ordinary: number;
  overtime_rate_restday_holiday: number;
  standard_hours_per_day: number;
  set_by: string | null;
  updated_at: string;
  company_id: string;
  /** Bitmask of workdays for the HR-analytics attendance denominator: bit0=Mon..bit6=Sun. */
  workdays_mask: number;
}

/** One mutable rate per worker — no effective-dating in v1. */
export interface WaaWorkerPay {
  worker_id: string;
  hourly_rate: number | null;
  set_by: string | null;
  updated_at: string;
}

/** Per-company (confirmed against information_schema — was missing company_id/default_amount here). */
export interface WaaDeductionType {
  id: string;
  name: string;
  active_by_default: boolean;
  company_id: string;
  default_amount: number;
}

/** Per-worker override of a deduction type's org-wide default. */
export interface WaaWorkerDeduction {
  id: string;
  worker_id: string;
  deduction_type_id: string;
  enabled: boolean;
  set_by: string | null;
  updated_at: string;
}

/** The leave-pay master switch. Off means every leave type is unpaid, no exceptions. */
export interface WaaWorkerLeavePay {
  worker_id: string;
  paid_leave_enabled: boolean;
  set_by: string | null;
  updated_at: string;
}

/** Only consulted when the master switch above is true. */
export interface WaaWorkerLeavePayType {
  id: string;
  worker_id: string;
  leave_type: string;
  enabled: boolean;
  set_by: string | null;
}

/* -------------------------------------------------------- Payroll runs --- */

export interface WaaPayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  status: PayrollRunStatus;
  created_by: string | null;
  reviewed_at: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface WaaPayslip {
  id: string;
  payroll_run_id: string;
  worker_id: string;
  worked_hours: number;
  overtime_hours: number;
  paid_leave_hours: number;
  unpaid_leave_days: number;
  regular_pay: number;
  overtime_pay: number;
  leave_pay: number;
  gross_pay: number;
  cash_advance_deducted: number;
  sss_deducted: number;
  pagibig_deducted: number;
  philhealth_deducted: number;
  withholding_tax_deducted: number;
  net_pay: number;
  proof_url: string | null;
  paid_at: string | null;
  created_at: string;
}

/** Payslip joined with its worker, as the HR/Admin grid fetches it. */
export interface WaaPayslipDetailed extends WaaPayslip {
  worker: Pick<
    WaaWorker,
    'id' | 'full_name' | 'position' | 'current_project_id' | 'supervisor_id'
  > | null;
}

export interface WaaLeaveRequest {
  id: string;
  worker_id: string;
  leave_type: string;
  date_from: string;
  date_to: string;
  reason: string | null;
  status: RequestStatus;
  decline_remarks: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface WaaLeaveRequestDetailed extends WaaLeaveRequest {
  worker: Pick<WaaWorker, 'id' | 'full_name'> | null;
}

export interface WaaNotification {
  id: string;
  recipient_id: string;
  recipient_type: RecipientType;
  message: string;
  is_read: boolean;
  created_at: string;
}

/** Response shape of the `waa-register-worker` edge function. `login_code`
 * (e.g. `WK-521031`) is the credential to actually hand the worker now;
 * `login_email` (the underlying phone-derived synthetic address) is still
 * returned but no longer shown anywhere in the UI. */
export interface RegisterWorkerResult {
  worker_id: string;
  login_code: string;
  login_email: string;
  temp_password: string;
}

/** Response shape of the `waa-register-supervisor` edge function. Same
 * `login_code` treatment as `RegisterWorkerResult`. */
export interface RegisterSupervisorResult {
  supervisor_id: string;
  login_code: string;
  login_email: string;
  temp_password: string;
}

/* --------------------------------------------- Platform Owner surface --- */

/** One HR/Admin as `waa-platform-owner-list-companies` nests it under a company. */
export interface PlatformOwnerHrAdmin {
  id: string;
  login_code: string | null;
  full_name: string | null;
  profile_complete: boolean;
  must_change_password: boolean;
}

/**
 * A company row as the Platform Owner sees it. This is the ONLY way Platform
 * Owner can read `waa_companies` — it holds no direct RLS grant on that table
 * (or any other), by design.
 */
export interface PlatformOwnerCompany {
  id: string;
  name: string;
  registration_number: string | null;
  business_address: string | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
  active: boolean;
  created_at: string;
  hr_admins: PlatformOwnerHrAdmin[];
}

/**
 * Response of `waa-platform-owner-create-company`. Both credential fields are
 * shown once and are not retrievable afterward — nothing stores them.
 */
export interface CreateCompanyResult {
  company_id: string;
  hr_admin_login_code: string;
  hr_admin_temp_password: string;
}

/** Response of `waa-platform-owner-reset-hr-admin-password`. Same once-only rule. */
export interface ResetHrAdminPasswordResult {
  hr_admin_login_code: string;
  hr_admin_temp_password: string;
}

/** Response shape of the `waa-generate-payroll-run` edge function. */
export interface GeneratePayrollRunResult {
  payroll_run_id: string;
  worker_count: number;
  payslips: { worker_id: string; net_pay: number }[];
}

/** Storage buckets. Private — always read through a signed URL. */
export type WaaBucket =
  | 'waa-selfies'
  | 'waa-ids'
  | 'waa-contracts'
  | 'waa-receipts'
  | 'waa-payroll-proofs';

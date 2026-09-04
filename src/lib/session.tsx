import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { WaaHrAdmin, WaaPlatformOwner, WaaSupervisor, WaaWorker } from './types';

export type Role = 'worker' | 'supervisor' | 'hr_admin' | 'platform_owner';

interface SessionState {
  /** Still resolving the stored session / role lookup. */
  loading: boolean;
  session: Session | null;
  role: Role | null;
  worker: WaaWorker | null;
  supervisor: WaaSupervisor | null;
  hrAdmin: WaaHrAdmin | null;
  platformOwner: WaaPlatformOwner | null;
  /** Set when a session exists but matches none of the four role tables. */
  roleError: string | null;
  /**
   * `must_change_password` from whichever role row matched — the account is
   * still on the temp password it was issued with. The root guard in
   * `app/_layout.tsx` holds every route except /change-password while this is
   * true; nothing else in the app should branch on it.
   *
   * Platform Owner is deliberately excluded: `waa_platform_owners` has no such
   * column at all (that account sets its own password directly, with no
   * temp-password handoff), so this stays false for it rather than reading a
   * field that does not exist.
   */
  mustChangePassword: boolean;
  /**
   * HR/Admin-only: `profile_complete = false` on the matched `waa_hr_admins`
   * row. The guard holds that role on /complete-profile after the password
   * reset and before its home screen. Worker and Supervisor have their own,
   * unrelated onboarding and never set this.
   */
  hrProfileIncomplete: boolean;
  /**
   * The tenant the signed-in account belongs to, from the matched role row.
   * Null for Platform Owner, which sits outside every company boundary.
   */
  companyId: string | null;
  /** Re-reads the worker/supervisor row (after a profile edit, say). */
  refreshProfile: () => Promise<void>;
  /**
   * Explicit, person-initiated sign-out (the "Sign out" button in Profile).
   * Full/"global" Supabase scope — revokes the refresh token server-side,
   * matching the confirmation dialog's "You will need your User ID and
   * password to get back in."
   */
  signOut: () => Promise<void>;
  /**
   * The 5-minute-idle timeout's sign-out — "both mobile and web app will
   * logout after 5 mins no activities." Ends the on-screen session (the root
   * guard bounces straight back to /login) using Supabase's "local" scope —
   * an idle timeout is not a deliberate choice to leave, so it doesn't need
   * the full server-side revoke `signOut` does.
   */
  idleSignOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [worker, setWorker] = useState<WaaWorker | null>(null);
  const [supervisor, setSupervisor] = useState<WaaSupervisor | null>(null);
  const [hrAdmin, setHrAdmin] = useState<WaaHrAdmin | null>(null);
  const [platformOwner, setPlatformOwner] = useState<WaaPlatformOwner | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  /**
   * Role resolution: a worker row wins, then a supervisor row, then an
   * HR/Admin row, then the Platform Owner row. RLS lets an authenticated user
   * read only their own row in each of the four tables, so a `maybeSingle()`
   * miss genuinely means "not this role".
   */
  const resolveRole = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setRole(null);
      setWorker(null);
      setSupervisor(null);
      setHrAdmin(null);
      setPlatformOwner(null);
      return;
    }

    const { data: workerRow, error: workerErr } = await supabase
      .from('waa_workers')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle<WaaWorker>();

    if (!workerErr && workerRow) {
      setWorker(workerRow);
      setSupervisor(null);
      setHrAdmin(null);
      setPlatformOwner(null);
      setRole('worker');
      setRoleError(null);
      return;
    }

    const { data: supRow, error: supErr } = await supabase
      .from('waa_supervisors')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle<WaaSupervisor>();

    if (!supErr && supRow) {
      setSupervisor(supRow);
      setWorker(null);
      setHrAdmin(null);
      setPlatformOwner(null);
      setRole('supervisor');
      setRoleError(null);
      return;
    }

    const { data: hrRow, error: hrErr } = await supabase
      .from('waa_hr_admins')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle<WaaHrAdmin>();

    if (!hrErr && hrRow) {
      setHrAdmin(hrRow);
      setWorker(null);
      setSupervisor(null);
      setPlatformOwner(null);
      setRole('hr_admin');
      setRoleError(null);
      return;
    }

    const { data: poRow, error: poErr } = await supabase
      .from('waa_platform_owners')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle<WaaPlatformOwner>();

    if (!poErr && poRow) {
      setPlatformOwner(poRow);
      setWorker(null);
      setSupervisor(null);
      setHrAdmin(null);
      setRole('platform_owner');
      setRoleError(null);
      return;
    }

    setRole(null);
    setWorker(null);
    setSupervisor(null);
    setHrAdmin(null);
    setPlatformOwner(null);
    setRoleError(
      'This account is signed in but is not linked to a worker, supervisor or HR/Admin ' +
        'record. Ask your supervisor or the office to check your registration.'
    );
  }, []);

  /** Which user id the current role state was resolved for. */
  const resolvedUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await resolveRole(data.session?.user.id);
      resolvedUserId.current = data.session?.user.id;
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return;
      const nextUserId = newSession?.user.id;
      // `loading` drives the root guard's full-screen splash, which unmounts
      // whatever is on screen. Only a genuine identity change (sign-in,
      // sign-out) warrants that. Same-user events — TOKEN_REFRESHED, and
      // USER_UPDATED from the forced password reset's own
      // `auth.updateUser()` — re-resolve the role quietly instead, so the
      // screen that triggered them stays mounted and can report its own
      // outcome rather than being replaced mid-submit.
      const sameUser = resolvedUserId.current === nextUserId;
      setSession(newSession);
      if (!sameUser) setLoading(true);
      await resolveRole(nextUserId);
      resolvedUserId.current = nextUserId;
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [resolveRole]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await resolveRole(data.session?.user.id);
  }, [resolveRole]);

  const clearRoleState = useCallback(() => {
    setRole(null);
    setWorker(null);
    setSupervisor(null);
    setHrAdmin(null);
    setPlatformOwner(null);
    setRoleError(null);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearRoleState();
  }, [clearRoleState]);

  const idleSignOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    clearRoleState();
  }, [clearRoleState]);

  // Derived from whichever of the three *company-scoped* rows matched —
  // `select('*')` above already brings these columns back, so there is no
  // extra fetch here. Platform Owner is not in this chain on purpose: it has
  // neither column, and reading `undefined` off it would silently look like
  // "false"/"no company" rather than "not applicable".
  const principal = worker ?? supervisor ?? hrAdmin;
  const mustChangePassword = principal?.must_change_password === true;
  const hrProfileIncomplete = hrAdmin?.profile_complete === false;
  const companyId = principal?.company_id ?? null;

  const value = useMemo<SessionState>(
    () => ({
      loading,
      session,
      role,
      worker,
      supervisor,
      hrAdmin,
      platformOwner,
      roleError,
      mustChangePassword,
      hrProfileIncomplete,
      companyId,
      refreshProfile,
      signOut,
      idleSignOut,
    }),
    [
      loading,
      session,
      role,
      worker,
      supervisor,
      hrAdmin,
      platformOwner,
      roleError,
      mustChangePassword,
      hrProfileIncomplete,
      companyId,
      refreshProfile,
      signOut,
      idleSignOut,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside a <SessionProvider>');
  return ctx;
}

/** Convenience for worker screens, which always run behind the worker guard. */
export function useWorker(): WaaWorker {
  const { worker } = useSession();
  if (!worker) throw new Error('useWorker called outside the worker flow');
  return worker;
}

/** Convenience for supervisor screens. */
export function useSupervisor(): WaaSupervisor {
  const { supervisor } = useSession();
  if (!supervisor) throw new Error('useSupervisor called outside the supervisor flow');
  return supervisor;
}

/** Convenience for HR/Admin screens, which always run behind the (hr) guard. */
export function useHrAdmin(): WaaHrAdmin {
  const { hrAdmin } = useSession();
  if (!hrAdmin) throw new Error('useHrAdmin called outside the HR/Admin flow');
  return hrAdmin;
}

/** Convenience for the `(platform-owner)` group. */
export function usePlatformOwner(): WaaPlatformOwner {
  const { platformOwner } = useSession();
  if (!platformOwner) throw new Error('usePlatformOwner called outside the Platform Owner flow');
  return platformOwner;
}

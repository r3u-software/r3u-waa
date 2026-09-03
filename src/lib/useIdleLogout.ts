import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

const IDLE_MS = 5 * 60 * 1000;
/** How often to check while foregrounded. Idle time spent backgrounded still
 * counts — there is no reset on backgrounding, only a catch-up check on
 * resume, since a timer this simple isn't guaranteed to keep firing while
 * the app is backgrounded on either platform. */
const CHECK_INTERVAL_MS = 15000;

/**
 * Signs the user out after five minutes with no touch/click/keypress/scroll,
 * on both web and native — "both mobile and web app will logout after 5 mins
 * no activities."
 *
 * Two different activity sources, since neither platform gives a single
 * global one:
 *   - Web: real DOM listeners on `window` (mousemove/keydown/scroll/etc).
 *   - Native: `markActivity()` is wired to a root-level `onStartShouldSetResponder`
 *     in app/_layout.tsx, which observes every touch without stealing it from
 *     whatever child actually handles it (returning `false` keeps the touch
 *     un-captured).
 *
 * `active` should be `!!session` — there is nothing to log out of, and
 * nothing to time, when signed out already.
 */
export function useIdleLogout(active: boolean, onIdle: () => void) {
  const lastActivity = useRef(Date.now());
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();

    const check = () => {
      if (Date.now() - lastActivity.current >= IDLE_MS) onIdleRef.current();
    };

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      // Catches idle time that accrued while backgrounded, which the
      // interval above can't be relied on to keep ticking through.
      if (state === 'active') check();
    });

    let removeWebListeners: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const reset = () => {
        lastActivity.current = Date.now();
      };
      const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
      removeWebListeners = () => events.forEach((e) => window.removeEventListener(e, reset));
    }

    return () => {
      clearInterval(interval);
      appStateSub.remove();
      removeWebListeners?.();
    };
  }, [active]);

  return {
    markActivity: () => {
      lastActivity.current = Date.now();
    },
  };
}

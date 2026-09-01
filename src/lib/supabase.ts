import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Copy app/.env.example to app/.env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart ' +
      'the dev server with `npx expo start -c`.'
  );
}

/**
 * Re-exported for the one place that has to talk to an edge function without a
 * session: the single login form calls `waa-resolve-login` with a bare `fetch`
 * (supabase-js `functions.invoke` would attach the stored — absent — session),
 * then applies the returned tokens with `auth.setSession`.
 */
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no URL bar, so there is no OAuth redirect to parse.
    detectSessionInUrl: false,
  },
});

/**
 * Workers log in with a phone number, but Supabase Auth is email-based, so
 * each worker gets a synthetic address derived from their digits
 * (`<digits>@workers.waa.r3u.local`; supervisors use
 * `@supervisors.waa.r3u.local`).
 *
 * The client no longer builds those addresses. Since the single-login change,
 * `waa-resolve-login` maps identifier -> candidate address(es) entirely
 * server-side, so the app never has to guess which role a phone number belongs
 * to — and a failed attempt can't reveal it either. `digitsOnly` is kept
 * because it is still the right way to normalise a typed phone number before
 * sending it anywhere.
 */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

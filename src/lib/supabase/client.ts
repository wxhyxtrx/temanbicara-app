import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://mcciuvlqvvvptgmelexi.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_JshNaL_CvRDPS1JD5nJs7g_iYKI0oIV';

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client publik (Client-side / Anon auth scope dengan PKCE & cookie support)
export const supabasePublic =
  typeof window !== 'undefined'
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: 'pkce',
        },
      });

// Client admin (Server-side bypass RLS untuk pendaftaran & verifikasi role)
export const supabaseAdmin =
  typeof window === 'undefined' && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : (null as unknown as ReturnType<typeof createClient>);

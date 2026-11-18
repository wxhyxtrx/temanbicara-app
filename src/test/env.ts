// Isolasi tes: tidak membuat client Supabase atau koneksi HTTP riil.
import { vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => {
  const unexpected = () => { throw new Error('Tes wajib menyuntikkan client DB tiruan'); };
  return { supabaseAdmin: { from: unexpected, rpc: unexpected }, supabasePublic: {} };
});
vi.stubGlobal('fetch', () => { throw new Error('HTTP eksternal dilarang dalam tes'); });

// Semua nilai placeholder, bukan kredensial asli.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-role-key';
export const TEST_SERVER_KEY = 'SB-Mid-server-DUMMY-TEST-KEY';
process.env.PAYMENT_SERVER_KEY = TEST_SERVER_KEY;

export interface RpcError {
  code?: string;
  message: string;
}

export interface RpcResult {
  data: unknown;
  error: RpcError | null;
}

/** Tangkap WalletHttpError (atau error lain) supaya bisa di-assert status & code-nya. */
export async function catchError(fn: () => Promise<unknown>): Promise<{ status?: number; code?: string; message: string }> {
  try {
    await fn();
  } catch (err) {
    return err as { status?: number; code?: string; message: string };
  }
  throw new Error('Diharapkan melempar error, tetapi berhasil');
}

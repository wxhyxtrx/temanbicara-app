import { supabaseAdmin } from '@/lib/supabase/client';
import { sanitizeLogMessage } from '@/lib/api/error-response';

export async function revokeUserSessions(userId: string): Promise<boolean> {
  try {
    if (!supabaseAdmin) {
      console.warn(sanitizeLogMessage('[REVOKE_SESSIONS] Supabase admin client tidak tersedia'));
      return false;
    }
    const { error } = await supabaseAdmin.rpc('revoke_user_sessions', { p_user_id: userId });
    if (error) {
      console.warn(sanitizeLogMessage('[REVOKE_SESSIONS] RPC gagal mencabut sesi pengguna'));
      return false;
    }
    return true;
  } catch {
    // Jangan log exception mentah: dapat memuat token atau kredensial request.
    console.warn(sanitizeLogMessage('[REVOKE_SESSIONS] Exception saat mencabut sesi pengguna'));
    return false;
  }
}

import { supabaseAdmin } from '@/lib/supabase/client';

export interface PasswordStatusResult {
  hasPassword: boolean;
  email: string;
  appMetadata?: Record<string, unknown>;
}

/**
 * Deteksi status password pengguna dari Supabase Auth secara terpusat di server.
 * Mode tidak pernah ditentukan oleh body request dari klien.
 */
export async function getPasswordStatus(userId: string): Promise<PasswordStatusResult> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client tidak tersedia');
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    throw new Error(error?.message || 'Pengguna auth tidak ditemukan');
  }

  const user = data.user;
  const hasEmailIdentity = Array.isArray(user.identities) && user.identities.some((id) => id.provider === 'email');
  const hasPasswordMeta = user.app_metadata?.has_password === true;
  const hasPassword = Boolean(hasEmailIdentity || hasPasswordMeta);
  const email = user.email || '';

  return {
    hasPassword,
    email,
    appMetadata: (user.app_metadata as Record<string, unknown>) ?? {},
  };
}

import type { PasswordFormDTO } from '@/lib/validations/auth';

export type PasswordUpdateResult =
  | { ok: true; mode: 'change' | 'create'; sessionRenewed: boolean }
  | {
      ok: false;
      kind: 'validation';
      message: string;
      fieldErrors?: Partial<Record<'current_password' | 'new_password' | 'confirm_password', string>>;
    }
  | { ok: false; kind: 'wrong_password'; message: string }
  | { ok: false; kind: 'server'; message: string };

const SERVER_ERROR_MESSAGE = 'Gagal menyimpan kata sandi. Coba lagi beberapa saat lagi.';

export const passwordClient = {
  /**
   * Mengambil status kepemilikan kata sandi akun aktif.
   * Klien tidak membaca/menulis cookie tb_access_token.
   */
  async getStatus(): Promise<{ hasPassword: boolean } | { error: string }> {
    try {
      const res = await fetch('/api/auth/password', {
        method: 'GET',
        credentials: 'include',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success || !json?.data) {
        const errorMsg =
          typeof json?.message === 'string' && json.message.trim()
            ? json.message
            : 'Gagal memuat status kata sandi. Coba lagi beberapa saat lagi.';
        return { error: errorMsg };
      }

      return {
        hasPassword: Boolean(json.data.has_password),
      };
    } catch {
      return {
        error: 'Gagal memuat status kata sandi. Coba lagi beberapa saat lagi.',
      };
    }
  },

  /**
   * Memperbarui atau membuat kata sandi baru.
   * Klien tidak membaca/menulis cookie tb_access_token.
   */
  async update(payload: PasswordFormDTO): Promise<PasswordUpdateResult> {
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.success && json?.data?.mode) {
        return {
          ok: true,
          mode: json.data.mode === 'create' ? 'create' : 'change',
          sessionRenewed: json.data.session_renewed !== false,
        };
      }

      if (res.status === 400) {
        if (json?.error === 'WRONG_CURRENT_PASSWORD') {
          return {
            ok: false,
            kind: 'wrong_password',
            message:
              typeof json?.message === 'string' && json.message.trim()
                ? json.message
                : 'Kata sandi lama salah.',
          };
        }

        if (json?.error === 'VALIDATION_ERROR') {
          const details = json?.details as Record<string, unknown> | undefined;
          const fieldErrors: Partial<Record<'current_password' | 'new_password' | 'confirm_password', string>> = {};

          if (details && typeof details === 'object') {
            for (const key of ['current_password', 'new_password', 'confirm_password'] as const) {
              const val = details[key];
              if (typeof val === 'string' && val.trim()) {
                fieldErrors[key] = val;
              } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
                fieldErrors[key] = val[0];
              }
            }
          }

          return {
            ok: false,
            kind: 'validation',
            message:
              typeof json?.message === 'string' && json.message.trim()
                ? json.message
                : 'Validasi gagal.',
            fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
          };
        }
      }

      return {
        ok: false,
        kind: 'server',
        message: SERVER_ERROR_MESSAGE,
      };
    } catch {
      return {
        ok: false,
        kind: 'server',
        message: SERVER_ERROR_MESSAGE,
      };
    }
  },
};

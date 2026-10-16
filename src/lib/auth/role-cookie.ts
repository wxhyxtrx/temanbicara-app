function getSecret(): string | null {
  const secret = process.env.ROLE_COOKIE_SECRET?.trim();
  return secret || null;
}

async function getHmacHex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Ekstrak 'sub' (User ID) dari Supabase JWT access token secara Edge-compatible.
 */
export function getJwtSub(token: string | undefined | null): string | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonStr = atob(base64);
    const payload = JSON.parse(jsonStr) as { sub?: string };
    return typeof payload.sub === 'string' && payload.sub.trim()
      ? payload.sub.trim()
      : null;
  } catch {
    return null;
  }
}

/**
 * Menandatangani role pengguna yang diikat ke userId dan exp (timestamp detik):
 * Format: `<role>.<userId>.<exp>.<hmac_hex>`
 */
export async function signRole(
  role: string,
  userId: string,
  maxAgeSeconds: number = 60 * 60 * 24 * 7
): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error('ROLE_COOKIE_SECRET environment variable is not configured');
  }

  const normalizedRole = role.trim().toLowerCase();
  const normalizedUserId = userId.trim();
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;

  const payload = `${normalizedRole}.${normalizedUserId}.${exp}`;
  const hex = await getHmacHex(payload, secret);
  return `${payload}.${hex}`;
}

/**
 * Memverifikasi tanda tangan HMAC pada cookie tb_user_role.
 * - Memeriksa keabsahan signature
 * - Memeriksa apakah exp belum lewat
 * - Memeriksa apakah userId sama dengan sub di access token
 */
export async function verifyRole(
  cookieValue: string | undefined | null,
  expectedUserId?: string | null
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) {
    return null;
  }

  if (!cookieValue || typeof cookieValue !== 'string') return null;

  const parts = cookieValue.split('.');

  // Format 4 bagian: <role>.<userId>.<exp>.<signature>
  if (parts.length === 4) {
    const [role, userId, expStr, signature] = parts;
    if (!role || !userId || !expStr || !signature) return null;

    const exp = Number(expStr);
    if (!Number.isFinite(exp)) return null;

    // 1. Cek batas kedaluwarsa (exp)
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > exp) return null;

    // 2. Cek apakah userId cocok dengan sub di access token
    if (expectedUserId && userId !== expectedUserId) {
      return null;
    }

    const payload = `${role.toLowerCase()}.${userId}.${expStr}`;
    const expectedHmac = await getHmacHex(payload, secret);

    if (signature.length !== expectedHmac.length) return null;

    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
    }

    return mismatch === 0 ? role.toLowerCase() : null;
  }

  // Format 2 bagian (legacy): <role>.<signature>
  if (parts.length === 2) {
    const [role, signature] = parts;
    if (!role || !signature) return null;

    const expectedHmac = await getHmacHex(role.toLowerCase(), secret);
    if (signature.length !== expectedHmac.length) return null;

    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
    }
    return mismatch === 0 ? role.toLowerCase() : null;
  }

  return null;
}

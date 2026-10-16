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
 * Menandatangani role pengguna menggunakan Web Crypto HMAC-SHA256: `<role>.<hmac_hex>`
 * Membutuhkan environment variable ROLE_COOKIE_SECRET.
 * Melempar error jika secret belum dikonfigurasi (tanpa fallback hardcode).
 */
export async function signRole(role: string): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error('ROLE_COOKIE_SECRET environment variable is not configured');
  }

  const normalized = role.trim().toLowerCase();
  const hex = await getHmacHex(normalized, secret);
  return `${normalized}.${hex}`;
}

/**
 * Memverifikasi tanda tangan HMAC pada cookie tb_user_role.
 * Mengembalikan role yang valid jika signature cocok.
 * Mengembalikan null jika secret kosong (semua dianggap belum login) atau signature tidak cocok.
 */
export async function verifyRole(
  cookieValue: string | undefined | null
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) {
    return null;
  }

  if (!cookieValue || typeof cookieValue !== 'string') return null;

  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex === -1) return null;

  const role = cookieValue.slice(0, dotIndex).trim().toLowerCase();
  const signature = cookieValue.slice(dotIndex + 1).trim();

  if (!role || !signature) return null;

  const expectedHmac = await getHmacHex(role, secret);

  if (signature.length !== expectedHmac.length) return null;

  // Constant-time character comparison to prevent timing attacks
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
  }

  return mismatch === 0 ? role : null;
}

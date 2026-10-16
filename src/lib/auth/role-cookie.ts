const ROLE_COOKIE_SECRET =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'temanbicara-fallback-role-secret-key-32b';

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
 * Kompatibel 100% dengan Next.js Edge Runtime tanpa Node.js dependencies.
 */
export async function signRole(role: string): Promise<string> {
  const normalized = role.trim().toLowerCase();
  const hex = await getHmacHex(normalized, ROLE_COOKIE_SECRET);
  return `${normalized}.${hex}`;
}

/**
 * Memverifikasi tanda tangan HMAC pada cookie tb_user_role.
 * Mengembalikan role yang valid jika signature cocok, atau null jika tidak valid / dimanipulasi.
 */
export async function verifyRole(
  cookieValue: string | undefined | null
): Promise<string | null> {
  if (!cookieValue || typeof cookieValue !== 'string') return null;

  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex === -1) return null;

  const role = cookieValue.slice(0, dotIndex).trim().toLowerCase();
  const signature = cookieValue.slice(dotIndex + 1).trim();

  if (!role || !signature) return null;

  const expectedHmac = await getHmacHex(role, ROLE_COOKIE_SECRET);

  if (signature.length !== expectedHmac.length) return null;

  // Constant-time character comparison to prevent timing attacks
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
  }

  return mismatch === 0 ? role : null;
}

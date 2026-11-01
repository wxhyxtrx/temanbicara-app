import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/security/csp-report
 * Endpoint publik penerima laporan pelanggaran Content Security Policy (CSP).
 * Bebas autentikasi, membatasi payload max 32 KB, tidak menyimpan ke database,
 * membersihkan query string pada log URL, dan selalu merespons HTTP 204 No Content.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    if (rawBody.length > 32768) {
      return new NextResponse(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (rawBody.trim().length > 0) {
      const data = JSON.parse(rawBody);
      const firstItem = Array.isArray(data) ? data[0] : data;
      const report = firstItem?.['csp-report'] || firstItem?.body || firstItem || {};
      const directive = report['effective-directive'] || report['violated-directive'];
      const rawBlockedUri = typeof report['blocked-uri'] === 'string' ? report['blocked-uri'] : '';
      const blockedUri = rawBlockedUri.split('?')[0];

      if (directive || blockedUri) {
        console.warn('[CSP_REPORT]:', { directive, blockedUri });
      }
    }
  } catch {
    // Malformed JSON / parsing errors diabaikan secara aman
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}

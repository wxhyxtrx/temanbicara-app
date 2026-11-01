import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_PAYLOAD_BYTES = 32768; // 32 KB

/**
 * POST /api/security/csp-report
 * Endpoint publik penerima laporan pelanggaran Content Security Policy (CSP).
 * Bebas autentikasi, menolak payload > 32 KB sebelum dibaca, tidak menyimpan ke database,
 * membersihkan query string pada log URL, dan selalu merespons HTTP 204 No Content.
 */
export async function POST(req: Request) {
  try {
    // 1. Periksa Content-Length sebelum membaca body stream
    const contentLengthHeader = req.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(contentLength) && contentLength > MAX_PAYLOAD_BYTES) {
        return new NextResponse(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    }

    // 2. Baca body dengan batas ukuran maksimal untuk mencegah pembacaan stream berlebih
    let rawBody = '';
    if (req.body) {
      const reader = req.body.getReader();
      const decoder = new TextDecoder();
      let bytesRead = 0;
      let exceeded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        if (bytesRead > MAX_PAYLOAD_BYTES) {
          exceeded = true;
          await reader.cancel();
          break;
        }
        rawBody += decoder.decode(value, { stream: true });
      }

      if (exceeded) {
        return new NextResponse(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      rawBody += decoder.decode();
    } else {
      rawBody = await req.text();
      if (rawBody.length > MAX_PAYLOAD_BYTES) {
        return new NextResponse(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
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

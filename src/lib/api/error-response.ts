import { NextResponse } from 'next/server';

const SENSITIVE_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // JWT tokens (eyJ...)
  {
    regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
    replacement: '[REDACTED_JWT]',
  },
  // Authorization: Bearer ...
  {
    regex: /Bearer\s+[A-Za-z0-9_\-\.]+/gi,
    replacement: 'Bearer [REDACTED]',
  },
  // Passwords in JSON or query params
  {
    regex: /"(?:current_)?password"\s*:\s*"[^"]*"/gi,
    replacement: '"password":"[REDACTED]"',
  },
  {
    regex: /(?:current_)?password=[^&\s]+/gi,
    replacement: 'password=[REDACTED]',
  },
  // Tokens / API keys in JSON or key-value
  {
    regex: /"(?:access_token|refresh_token|token|api_key|secret)"\s*:\s*"[^"]*"/gi,
    replacement: '"token":"[REDACTED]"',
  },
  {
    regex: /(?:access_token|refresh_token|api_key|service_role)=[^&\s]+/gi,
    replacement: 'token=[REDACTED]',
  },
  // Sensitive patient curhat / story content
  {
    regex: /"(?:content|story|curhat|complaint)"\s*:\s*"[^"]*"/gi,
    replacement: '"content":"[REDACTED_CONTENT]"',
  },
  // Database connection URLs
  {
    regex: /postgres(?:ql)?:\/\/[^\s@]+@[^\s/]+/gi,
    replacement: 'postgresql://[REDACTED_DB_URL]',
  },
];

export function sanitizeLogMessage(input: string): string {
  let sanitized = input;
  for (const { regex, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

export function internalErrorResponse(
  err: unknown,
  fallbackMessage = 'Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.'
): NextResponse {
  const rawMessage =
    err instanceof Error
      ? err.stack || `${err.name}: ${err.message}`
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err)
        : String(err);

  const safeLog = sanitizeLogMessage(rawMessage);
  console.error('[API_INTERNAL_ERROR]:', safeLog);

  const message = fallbackMessage || 'Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.';

  return NextResponse.json(
    {
      success: false,
      error: 'INTERNAL_ERROR',
      message,
    },
    { status: 500 }
  );
}

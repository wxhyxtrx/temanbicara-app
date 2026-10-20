import { NextResponse, type NextRequest } from 'next/server';
import { verifyRole, getJwtSub } from '@/lib/auth/role-cookie';
import { getMaintenanceStatus } from '@/lib/maintenance';

const AUTH_PAGES = ['/login', '/register', '/register/counselor', '/register/listener'];

const ROLE_DASHBOARDS: Record<string, string> = {
  pasien: '/patient/beranda',
  patient: '/patient/beranda',
  psikolog: '/counselor/beranda',
  counselor: '/counselor/beranda',
  relawan: '/listener/beranda',
  peer_listener: '/listener/beranda',
  admin: '/admin/beranda',
};

function isMaintenanceBypass(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '');
  return (
    p === '/api/webhooks/midtrans' ||
    p.startsWith('/api/webhooks/midtrans/') ||
    p === '/api/cron' ||
    p.startsWith('/api/cron/') ||
    p === '/api/auth' ||
    p.startsWith('/api/auth/') ||
    p === '/api/admin' ||
    p.startsWith('/api/admin/') ||
    p === '/api/settings/public' ||
    p.startsWith('/api/settings/public/')
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const normalizedPath = pathname.replace(/\/$/, '');

  // 1. Pengecualian Mutlak Maintenance (Bypass)
  // Webhook Midtrans, Cron, Auth, seluruh API admin, dan settings public tidak terblokir maintenance
  if (isMaintenanceBypass(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('tb_access_token')?.value;
  const rawRoleCookie = req.cookies.get('tb_user_role')?.value;
  const userStatus = req.cookies.get('tb_user_status')?.value || 'active';

  // Ekstrak sub (userId) dari access token untuk verifikasi pengikatan sesi
  const tokenSub = getJwtSub(token);

  // Verifikasi tanda tangan HMAC pada tb_user_role (terikat ke role + userId + exp)
  const verifiedRole = await verifyRole(rawRoleCookie, tokenSub);
  const isAdmin = verifiedRole?.toLowerCase() === 'admin';

  // Ambil status maintenance sistem terkini (cache 5 detik)
  const maintenance = await getMaintenanceStatus();
  const phase = maintenance.phase;

  // 2. Proteksi Halaman /maintenance
  // Saat fase none atau scheduled: akses ke /maintenance dialihkan kembali ke /
  if (normalizedPath === '/maintenance' || normalizedPath.startsWith('/maintenance/')) {
    if (phase === 'none' || phase === 'scheduled') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // 3. Role Admin Bebas Akses ke Seluruh Rute Privat dan API
  if (isAdmin && pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 4. Penegakan Fase Maintenance Active
  if (phase === 'active') {
    // Seluruh API non-admin mengembalikan HTTP 503 MAINTENANCE_ACTIVE (bukan 401/403)
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        {
          success: false,
          error: 'MAINTENANCE_ACTIVE',
          message: maintenance.message,
        },
        { status: 503 }
      );
    }

    // Pengunjung / role non-admin yang membuka /patient/*, /counselor/*, /listener/* dialihkan ke /maintenance
    if (
      normalizedPath.startsWith('/patient') ||
      normalizedPath.startsWith('/counselor') ||
      normalizedPath.startsWith('/listener')
    ) {
      return NextResponse.redirect(new URL('/maintenance', req.url));
    }
  }

  // 5. Penegakan Fase Maintenance Draining
  if (phase === 'draining') {
    if (req.method === 'POST') {
      const isDrainingBlockedEndpoint =
        normalizedPath === '/api/bookings' ||
        normalizedPath === '/api/wallet/topup' ||
        normalizedPath === '/api/wallet/payout';

      if (isDrainingBlockedEndpoint) {
        return NextResponse.json(
          {
            success: false,
            error: 'MAINTENANCE_DRAINING',
            message: 'Sistem sedang bersiap untuk pemeliharaan. Transaksi baru ditunda.',
          },
          { status: 503 }
        );
      }
    }
  }

  // 6. Rute API yang lolos pemeriksaan maintenance langsung diteruskan ke handler API masing-masing
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // --- Mulai Logika Autentikasi & Rute Halaman Aplikasi ---
  const isAuthPage = AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
  const isStatusPage =
    pathname === '/status' ||
    pathname.startsWith('/status') ||
    pathname === '/auth/status' ||
    pathname.startsWith('/auth/status');
  const isPrivatePortal =
    pathname.startsWith('/patient') ||
    pathname.startsWith('/counselor') ||
    pathname.startsWith('/listener') ||
    pathname.startsWith('/admin');

  // Normalisasi /auth/status ke /status
  if (pathname === '/auth/status' || pathname.startsWith('/auth/status')) {
    return NextResponse.redirect(new URL('/status', req.url));
  }

  // Sesi valid HANYA jika ada access_token DAN tb_user_role memiliki tanda tangan HMAC yang sah
  const hasValidAuth = Boolean(token && verifiedRole);

  // 7. Pengunjung tanpa auth sah dilarang mengakses modul dashboard privat & halaman status
  if (!hasValidAuth && (isPrivatePortal || isStatusPage)) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    const res = NextResponse.redirect(loginUrl);

    // Jika ada token/cookie tidak valid (mis. role dimanipulasi), bersihkan cookie
    if (token || rawRoleCookie) {
      res.cookies.delete('tb_access_token');
      res.cookies.delete('tb_refresh_token');
      res.cookies.delete('tb_user_role');
      res.cookies.delete('tb_user_status');
    }
    return res;
  }

  // 8. User terautentikasi tetapi status akun BELUM AKTIF
  if (hasValidAuth && userStatus !== 'active') {
    // Izinkan akses ke /status, landing page (/), dan pusat bantuan
    if (isStatusPage || pathname === '/' || pathname.startsWith('/help-center')) {
      return NextResponse.next();
    }

    // Blokir akses ke fitur privat maupun login/register ulang -> paksa ke /status
    if (isPrivatePortal || isAuthPage) {
      return NextResponse.redirect(new URL('/status', req.url));
    }
  }

  // 9. User terautentikasi dengan status AKTIF
  if (hasValidAuth && userStatus === 'active') {
    const userRole = verifiedRole!;
    const defaultDashboard = ROLE_DASHBOARDS[userRole] || '/patient/beranda';

    // Akun aktif tidak memerlukan halaman status lagi
    if (isStatusPage) {
      return NextResponse.redirect(new URL(defaultDashboard, req.url));
    }

    // Akun aktif dicegah login / register ulang
    if (isAuthPage) {
      return NextResponse.redirect(new URL(defaultDashboard, req.url));
    }

    // Isolasi modul privat antar-role (berbasis verified role yang telah ditandatangani secara kriptografis)
    if (isPrivatePortal) {
      const normalizedRole = userRole.toLowerCase();
      const isPatientPortal = pathname.startsWith('/patient');
      const isCounselorPortal = pathname.startsWith('/counselor');
      const isListenerPortal = pathname.startsWith('/listener');
      const isAdminPortal = pathname.startsWith('/admin');

      const isPatient = normalizedRole === 'pasien' || normalizedRole === 'patient';
      const isCounselor = normalizedRole === 'psikolog' || normalizedRole === 'counselor';
      const isListener = normalizedRole === 'relawan' || normalizedRole === 'peer_listener';
      const isAdminUser = normalizedRole === 'admin';

      if (isPatient && !isPatientPortal) {
        return NextResponse.redirect(new URL('/patient/beranda', req.url));
      }
      if (isCounselor && !isCounselorPortal) {
        return NextResponse.redirect(new URL('/counselor/beranda', req.url));
      }
      if (isListener && !isListenerPortal) {
        return NextResponse.redirect(new URL('/listener/beranda', req.url));
      }
      if (isAdminUser && !isAdminPortal) {
        return NextResponse.redirect(new URL('/admin/beranda', req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image
     * - favicon.ico, images, fonts
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)).*)',
  ],
};

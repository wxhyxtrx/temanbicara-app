import { NextResponse, type NextRequest } from 'next/server';
import { verifyRole } from '@/lib/auth/role-cookie';

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('tb_access_token')?.value;
  const rawRoleCookie = req.cookies.get('tb_user_role')?.value;
  const userStatus = req.cookies.get('tb_user_status')?.value || 'active';

  // Verifikasi tanda tangan HMAC pada tb_user_role
  // Jika tanda tangan tidak cocok atau cookie dimanipulasi di DevTools,
  // anggap pengguna tidak login (redirect /login).
  const verifiedRole = await verifyRole(rawRoleCookie);

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

  // 1. Pengunjung tanpa auth sah dilarang mengakses modul dashboard privat & halaman status
  if (!hasValidAuth && (isPrivatePortal || isStatusPage)) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    const res = NextResponse.redirect(loginUrl);

    // Jika ada token/cookie tidak valid (mis. role dimanipulasi), bersihkan cookie
    if (token || rawRoleCookie) {
      res.cookies.delete('tb_access_token');
      res.cookies.delete('tb_user_role');
      res.cookies.delete('tb_user_status');
    }
    return res;
  }

  // 2. User terautentikasi tetapi status akun BELUM AKTIF
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

  // 3. User terautentikasi dengan status AKTIF
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
      const isAdmin = normalizedRole === 'admin';

      if (isPatient && !isPatientPortal) {
        return NextResponse.redirect(new URL('/patient/beranda', req.url));
      }
      if (isCounselor && !isCounselorPortal) {
        return NextResponse.redirect(new URL('/counselor/beranda', req.url));
      }
      if (isListener && !isListenerPortal) {
        return NextResponse.redirect(new URL('/listener/beranda', req.url));
      }
      if (isAdmin && !isAdminPortal) {
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
     * - api routes
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)).*)',
  ],
};

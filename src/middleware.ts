import { NextResponse, type NextRequest } from 'next/server';

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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('tb_access_token')?.value;
  const userRole = req.cookies.get('tb_user_role')?.value || 'patient';
  const userStatus = req.cookies.get('tb_user_status')?.value || 'active';

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

  // 1. Pengunjung tanpa token dilarang mengakses modul dashboard privat & halaman status
  if (!token && (isPrivatePortal || isStatusPage)) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. User terautentikasi tetapi status akun BELUM AKTIF
  if (token && userStatus !== 'active') {
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
  if (token && userStatus === 'active') {
    const defaultDashboard = ROLE_DASHBOARDS[userRole] || '/patient/beranda';

    // Akun aktif tidak memerlukan halaman status lagi
    if (isStatusPage) {
      return NextResponse.redirect(new URL(defaultDashboard, req.url));
    }

    // Akun aktif dicegah login / register ulang
    if (isAuthPage) {
      return NextResponse.redirect(new URL(defaultDashboard, req.url));
    }

    // Isolasi modul privat antar-role
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

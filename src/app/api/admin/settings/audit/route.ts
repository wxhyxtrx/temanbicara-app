import { NextResponse } from 'next/server';
import { getSessionUser, fail, pageParams } from '@/lib/auth/session';
import { SystemSettingsService } from '@/services/system-settings.service';

export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat melihat riwayat audit ini');
    }

    const url = new URL(req.url);
    const { page, limit } = pageParams(url, 20);
    const key = url.searchParams.get('key');

    const result = await SystemSettingsService.getAuditLog({
      page,
      limit,
      key,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memuat log audit pengaturan');
  }
}

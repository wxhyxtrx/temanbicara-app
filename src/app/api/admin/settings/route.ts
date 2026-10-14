import { NextResponse } from 'next/server';
import { getSessionUser, fail } from '@/lib/auth/session';
import { SystemSettingsService } from '@/services/system-settings.service';

export async function GET() {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat mengakses konfigurasi ini');
    }

    const data = await SystemSettingsService.getAdminSettings();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memuat pengaturan admin');
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat memperbarui konfigurasi ini');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'BAD_REQUEST', 'Request body bukan format JSON yang valid');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail(400, 'BAD_REQUEST', 'Request body harus berupa JSON object');
    }

    const result = await SystemSettingsService.updateSettings(
      body as Record<string, unknown>,
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'VALIDATION_ERROR',
          message: 'Validasi pengaturan gagal',
          details: result.details,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pengaturan sistem berhasil diperbarui',
      data: result.data,
    });
  } catch (error) {
    console.error('Error updating admin settings:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memperbarui pengaturan sistem');
  }
}

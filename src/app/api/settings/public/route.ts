import { NextResponse } from 'next/server';
import { SystemSettingsService } from '@/services/system-settings.service';

export async function GET() {
  try {
    const settings = await SystemSettingsService.getPublicSettings();

    return NextResponse.json(
      {
        success: true,
        data: settings,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Gagal memuat pengaturan publik',
      },
      { status: 500 }
    );
  }
}

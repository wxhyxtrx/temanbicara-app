import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail } from '@/lib/auth/session';
import { saveMitraBankAccountSchema } from '@/lib/validations/mitra-bank-account';

export async function GET() {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.role !== 'psikolog' && session.user.role !== 'relawan') {
      return fail(403, 'FORBIDDEN', 'Hanya mitra (psikolog atau relawan) yang dapat mengakses rekening bank');
    }

    if (session.user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun mitra belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data, error } = await supabaseAdmin
      .from('mitra_bank_accounts')
      .select('bank_name, account_number, bank_account_name, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching mitra bank account');
      return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memuat data rekening bank');
    }

    return NextResponse.json({
      success: true,
      data: {
        account: data
          ? {
              bank_name: data.bank_name,
              account_number: data.account_number,
              bank_account_name: data.bank_account_name,
              updated_at: data.updated_at,
            }
          : null,
      },
    });
  } catch {
    console.error('Error fetching mitra bank account');
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memuat data rekening bank');
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.role !== 'psikolog' && session.user.role !== 'relawan') {
      return fail(403, 'FORBIDDEN', 'Hanya mitra (psikolog atau relawan) yang dapat menyimpan rekening bank');
    }

    if (session.user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun mitra belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'BAD_REQUEST', 'Request body bukan format JSON yang valid');
    }

    const parsed = saveMitraBankAccountSchema.safeParse(body);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data rekening bank tidak valid');
    }

    const { bank_name, account_number, bank_account_name } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from('mitra_bank_accounts')
      .upsert(
        {
          user_id: session.user.id,
          bank_name,
          account_number,
          bank_account_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('bank_name, account_number, bank_account_name, updated_at')
      .single();

    if (error || !data) {
      console.error('Error saving mitra bank account');
      return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal menyimpan data rekening bank');
    }

    return NextResponse.json({
      success: true,
      data: {
        account: {
          bank_name: data.bank_name,
          account_number: data.account_number,
          bank_account_name: data.bank_account_name,
          updated_at: data.updated_at,
        },
      },
    });
  } catch {
    console.error('Error saving mitra bank account');
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal menyimpan data rekening bank');
  }
}

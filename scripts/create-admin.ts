import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[ERROR] SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum terisi di .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const args = process.argv.slice(2);
  const email = args[0] || process.env.ADMIN_DEFAULT_EMAIL || 'admin@temanbicara.id';
  const password = args[1] || process.env.ADMIN_DEFAULT_PASSWORD || 'AdminTemanBicara2026!';
  const fullName = 'Super Administrator';

  console.log(`[INFO] Membuat akun superadmin: ${email}...`);

  // 1. Cek apakah user sudah ada
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    console.log(`[WARN] User ${email} sudah terdaftar dengan role ${existingUser.role}.`);
    process.exit(0);
  }

  // 2. Buat akun di Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin', full_name: fullName },
  });

  if (authError || !authData.user) {
    console.error('[ERROR] Gagal membuat auth user:', authError?.message);
    process.exit(1);
  }

  const userId = authData.user.id;

  // 3. Masukkan ke public.users
  const { error: userError } = await supabaseAdmin.from('users').insert({
    id: userId,
    email,
    role: 'admin',
    status: 'active',
    is_email_verified: true,
  });

  if (userError) {
    console.error('[ERROR] Gagal insert ke public.users:', userError.message);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  // 4. Masukkan ke public.admin_profiles
  const { error: profileError } = await supabaseAdmin.from('admin_profiles').insert({
    user_id: userId,
    nama_lengkap: fullName,
    level: 'superadmin',
  });

  if (profileError) {
    console.error('[ERROR] Gagal insert ke public.admin_profiles:', profileError.message);
    process.exit(1);
  }

  console.log(`[SUCCESS] Akun admin berhasil dibuat!`);
  console.log(`  Email: ${email}`);
  console.log(`  Role : admin`);
  console.log(`  User ID: ${userId}`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

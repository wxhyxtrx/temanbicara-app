import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function cleanup() {
  const { supabaseAdmin } = await import('../src/lib/supabase/client');

  const { data: testUsers } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .like('email', '%@test.com');

  if (testUsers && testUsers.length > 0) {
    for (const u of testUsers) {
      await supabaseAdmin.from('users').delete().eq('id', u.id);
      await supabaseAdmin.auth.admin.deleteUser(u.id);
      console.log(`Cleaned test user: ${u.email}`);
    }
  }
}

cleanup().catch(console.error);

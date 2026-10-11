import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Helper to dynamically import routes after env is populated
async function runTests() {
  const { POST: registerPasien } = await import('../src/app/api/auth/register/pasien/route');
  const { POST: registerRelawan } = await import('../src/app/api/auth/register/relawan/route');
  const { POST: registerPsikolog } = await import('../src/app/api/auth/register/psikolog/route');
  const { POST: loginUser } = await import('../src/app/api/auth/login/route');
  const { POST: getPresignedUrl } = await import('../src/app/api/upload/presigned-url/route');

  console.log('--- START INTEGRATION TESTS: AUTH & REGISTRATION ---');

  const timestamp = Date.now();
  const testPasienEmail = `pasien_${timestamp}@test.com`;
  const testRelawanEmail = `relawan_${timestamp}@test.com`;
  const testPsikologEmail = `psikolog_${timestamp}@test.com`;
  const testStrNumber = `STR-${timestamp}`;

  // 1. TEST PRESIGNED UPLOAD URL
  console.log('\n[1/6] Testing Presigned Upload URL...');
  const uploadReq = new Request('http://localhost:3000/api/upload/presigned-url', {
    method: 'POST',
    body: JSON.stringify({
      file_name: 'ijazah_str.pdf',
      file_type: 'application/pdf',
      document_type: 'sipp_str',
      user_email_or_temp_id: 'test_user',
    }),
  });
  const uploadRes = await getPresignedUrl(uploadReq);
  const uploadData = await uploadRes.json();
  console.log('Status:', uploadRes.status);
  console.log('Upload URL created:', uploadData.data?.file_path ? 'OK' : 'FAIL');
  if (uploadRes.status !== 200) throw new Error('Presigned URL failed');

  // 2. TEST REGISTER PASIEN
  console.log('\n[2/6] Testing Register Pasien...');
  const pasienReq = new Request('http://localhost:3000/api/auth/register/pasien', {
    method: 'POST',
    body: JSON.stringify({
      nama_lengkap: 'Budi Pasien Test',
      email: testPasienEmail,
      no_wa: '081234567890',
      password: 'PasswordPasien123!',
      password_confirmation: 'PasswordPasien123!',
    }),
  });
  const pasienRes = await registerPasien(pasienReq);
  const pasienData = await pasienRes.json();
  console.log('Status:', pasienRes.status);
  console.log('Result:', pasienData);
  if (pasienRes.status !== 201) throw new Error('Register Pasien failed');

  // 3. TEST REGISTER RELAWAN
  console.log('\n[3/6] Testing Register Relawan...');
  const relawanReq = new Request('http://localhost:3000/api/auth/register/relawan', {
    method: 'POST',
    body: JSON.stringify({
      nama_lengkap: 'Siti Relawan Test',
      email: testRelawanEmail,
      no_wa: '081987654321',
      password: 'PasswordRelawan123!',
      password_confirmation: 'PasswordRelawan123!',
      latar_belakang: 'Mahasiswa Psikologi UI Semester 6',
      dokumen_cv_url: uploadData.data.file_path,
      alasan_bergabung: 'Ingin mengabdi dan mendengarkan keluhan teman sebaya dengan empati.',
    }),
  });
  const relawanRes = await registerRelawan(relawanReq);
  const relawanData = await relawanRes.json();
  console.log('Status:', relawanRes.status);
  console.log('Result:', relawanData);
  if (relawanRes.status !== 201) throw new Error('Register Relawan failed');

  // 4. TEST REGISTER PSIKOLOG
  console.log('\n[4/6] Testing Register Psikolog...');
  const psikologReq = new Request('http://localhost:3000/api/auth/register/psikolog', {
    method: 'POST',
    body: JSON.stringify({
      nama_lengkap_gelar: 'Dr. Hendra Wijaya, M.Psi.',
      email: testPsikologEmail,
      no_wa: '081345678901',
      password: 'PasswordPsikolog123!',
      password_confirmation: 'PasswordPsikolog123!',
      nomor_sipp_str: testStrNumber,
      dokumen_sipp_str_url: uploadData.data.file_path,
      spesialisasi: ['Kecemasan', 'Depresi', 'Trauma'],
      tahun_pengalaman: 5,
      tarif_sesi: 200000,
    }),
  });
  const psikologRes = await registerPsikolog(psikologReq);
  const psikologData = await psikologRes.json();
  console.log('Status:', psikologRes.status);
  console.log('Result:', psikologData);
  if (psikologRes.status !== 201) throw new Error('Register Psikolog failed');

  // 5. TEST LOGIN PASIEN (ACTIVE -> /dashboard/pasien)
  console.log('\n[5/6] Testing Login Pasien...');
  const loginPasienReq = new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testPasienEmail,
      password: 'PasswordPasien123!',
    }),
  });
  const loginPasienRes = await loginUser(loginPasienReq);
  const loginPasienData = await loginPasienRes.json();
  console.log('Status:', loginPasienRes.status);
  console.log('Redirect:', loginPasienData.data?.redirect_to);
  if (loginPasienData.data?.redirect_to !== '/dashboard/pasien') {
    throw new Error('Pasien redirect incorrect');
  }

  // 6. TEST LOGIN RELAWAN (PENDING_APPROVAL -> /status/menunggu-verifikasi)
  console.log('\n[6/6] Testing Login Relawan Pending...');
  const loginRelawanReq = new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testRelawanEmail,
      password: 'PasswordRelawan123!',
    }),
  });
  const loginRelawanRes = await loginUser(loginRelawanReq);
  const loginRelawanData = await loginRelawanRes.json();
  console.log('Status:', loginRelawanRes.status);
  console.log('Redirect:', loginRelawanData.data?.redirect_to);
  if (loginRelawanData.data?.redirect_to !== '/status/menunggu-verifikasi') {
    throw new Error('Relawan pending redirect incorrect');
  }

  console.log('\n--- ALL INTEGRATION TESTS PASSED (100% OK) ---');
}

runTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});

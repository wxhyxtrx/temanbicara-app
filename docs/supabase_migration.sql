-- ========================================================
-- TEMAN BICARA: SUPABASE INITIAL DATABASE MIGRATION
-- Eksekusi file ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('pasien', 'relawan', 'psikolog', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM (
        'active',
        'unverified_email',
        'incomplete_profile',
        'pending_approval',
        'pending_verification',
        'rejected',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('pending_payment', 'scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE peer_status AS ENUM ('waiting', 'active', 'ended', 'escalated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'settlement', 'deny', 'expire', 'cancel', 'refund');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crisis_risk_level AS ENUM ('low', 'medium', 'high', 'severe');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. USERS (CENTRAL USER TABLE)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    no_wa VARCHAR(30),
    google_id VARCHAR(255) UNIQUE,
    role user_role NOT NULL DEFAULT 'pasien',
    status account_status NOT NULL DEFAULT 'active',
    avatar_url TEXT,
    is_email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. PROFILE PER ROLE
CREATE TABLE IF NOT EXISTS public.pasien_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    nama_lengkap VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.relawan_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    nama_lengkap VARCHAR(255) NOT NULL,
    latar_belakang VARCHAR(255) NOT NULL,
    dokumen_cv_url TEXT NOT NULL,
    alasan_bergabung TEXT NOT NULL,
    total_sesi INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.psikolog_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    nama_lengkap_gelar VARCHAR(255) NOT NULL,
    nomor_sipp_str VARCHAR(100) NOT NULL UNIQUE,
    dokumen_sipp_str_url TEXT NOT NULL,
    spesialisasi TEXT[] NOT NULL DEFAULT '{}',
    tahun_pengalaman INT NOT NULL DEFAULT 0,
    tarif_sesi NUMERIC(12, 2) NOT NULL DEFAULT 0,
    saldo NUMERIC(12, 2) NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.admin_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    nama_lengkap VARCHAR(255) NOT NULL,
    level VARCHAR(50) NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. STORAGE BUCKET FOR DOCUMENTS (PRIVATE BUCKET)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'dokumen-mitra',
    'dokumen-mitra',
    false,
    5242880,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pasien_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relawan_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psikolog_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- POLICIES: USERS
CREATE POLICY "Users can read own profile"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admin can read all users"
ON public.users FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- POLICIES: PASIEN
CREATE POLICY "Pasien can manage own profile"
ON public.pasien_profiles FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- POLICIES: RELAWAN
CREATE POLICY "Relawan can read own profile"
ON public.relawan_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin manage relawan"
ON public.relawan_profiles FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- POLICIES: PSIKOLOG
CREATE POLICY "Public read approved psikolog"
ON public.psikolog_profiles FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = user_id AND users.status = 'active')
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Psikolog update own profile non-financial"
ON public.psikolog_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- POLICIES: STORAGE OBJECTS (dokumen-mitra)
CREATE POLICY "Mitra upload own docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'dokumen-mitra' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Mitra and admin view docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'dokumen-mitra' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    )
);

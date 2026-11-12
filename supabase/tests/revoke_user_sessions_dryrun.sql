-- Jalankan sebagai owner di lingkungan uji; seluruh perubahan dibatalkan.
BEGIN;

-- DDL migrasi disalin di sini agar dry-run tidak memerlukan penerapan permanen.
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count integer;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id must not be NULL' USING ERRCODE = '22004';
    END IF;
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;

DO $$
DECLARE
    v_user_a uuid := pg_catalog.gen_random_uuid();
    v_user_b uuid := pg_catalog.gen_random_uuid();
    v_session_a1 uuid := pg_catalog.gen_random_uuid();
    v_session_a2 uuid := pg_catalog.gen_random_uuid();
    v_session_b uuid := pg_catalog.gen_random_uuid();
    v_count integer;
BEGIN
    IF pg_catalog.has_function_privilege('authenticated', 'public.revoke_user_sessions(uuid)', 'EXECUTE')
       OR pg_catalog.has_function_privilege('anon', 'public.revoke_user_sessions(uuid)', 'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('service_role', 'public.revoke_user_sessions(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Invalid EXECUTE privileges';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc AS p
        WHERE p.oid = 'public.revoke_user_sessions(uuid)'::pg_catalog.regprocedure
          AND p.prosecdef AND 'search_path=""' = ANY(p.proconfig)
    ) THEN
        RAISE EXCEPTION 'Missing SECURITY DEFINER or empty search_path';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint AS c
        WHERE c.conname = 'refresh_tokens_session_id_fkey'
          AND c.conrelid = 'auth.refresh_tokens'::pg_catalog.regclass
          AND c.confrelid = 'auth.sessions'::pg_catalog.regclass
          AND c.confdeltype = 'c'
          AND c.convalidated
    ) THEN
        RAISE EXCEPTION 'Missing validated refresh token cascade FK';
    END IF;

    INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
    VALUES (v_user_a, 'authenticated', 'authenticated', v_user_a::text || '@example.invalid', '{}'::jsonb, '{}'::jsonb),
           (v_user_b, 'authenticated', 'authenticated', v_user_b::text || '@example.invalid', '{}'::jsonb, '{}'::jsonb);
    INSERT INTO auth.sessions (id, user_id, created_at, updated_at)
    VALUES (v_session_a1, v_user_a, pg_catalog.now(), pg_catalog.now()),
           (v_session_a2, v_user_a, pg_catalog.now(), pg_catalog.now()),
           (v_session_b, v_user_b, pg_catalog.now(), pg_catalog.now());

    -- NULL harus ditolak tanpa menyentuh sesi mana pun.
    BEGIN
        PERFORM public.revoke_user_sessions(NULL);
        RAISE EXCEPTION 'NULL input accepted';
    EXCEPTION WHEN null_value_not_allowed THEN
        NULL; -- Error yang diharapkan (22004).
    END;
    IF (SELECT pg_catalog.count(*) FROM auth.sessions WHERE user_id = v_user_a) <> 2
       OR NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = v_session_b) THEN
        RAISE EXCEPTION 'NULL input changed sessions';
    END IF;

    v_count := public.revoke_user_sessions(v_user_a);
    IF v_count <> 2 OR EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = v_user_a) THEN
        RAISE EXCEPTION 'Target sessions not fully revoked';
    END IF;
    IF (SELECT pg_catalog.count(*) FROM auth.sessions WHERE user_id = v_user_b) <> 1
       OR NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = v_session_b) THEN
        RAISE EXCEPTION 'Other user sessions changed';
    END IF;
    IF EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE session_id IN (v_session_a1, v_session_a2)) THEN
        RAISE EXCEPTION 'Target refresh tokens remain';
    END IF;
    IF public.revoke_user_sessions(v_user_a) <> 0 THEN
        RAISE EXCEPTION 'Repeated revoke must return zero';
    END IF;
    RAISE EXCEPTION 'DRYRUN_OK';
END;
$$;
ROLLBACK;

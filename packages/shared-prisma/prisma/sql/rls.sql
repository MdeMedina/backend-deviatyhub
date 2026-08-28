-- ============================================================================
-- Row Level Security (RLS) multi-tenant — Deviaty Hub  (U10)
-- ============================================================================
-- IMPORTANTE — leer antes de ejecutar:
--
--  * Este script es para SUPABASE (producción). Usa `auth.jwt()`, una función
--    que SOLO existe en Supabase; en un Postgres plano fallará.
--  * Prisma NO puede aplicar RLS con `db push`; hay que correr este SQL a mano
--    (Supabase SQL Editor) o con `prisma db execute --file prisma/sql/rls.sql`.
--  * El backend conecta con la SERVICE ROLE / conexión directa, que en Supabase
--    HACE BYPASS de RLS por diseño. Por eso RLS aquí NO rompe las queries de
--    Prisma: protege el acceso vía la API de datos de Supabase (roles anon /
--    authenticated). El aislamiento en el backend ya se hace a nivel de app
--    (todas las queries filtran por clinic_id del JWT); RLS es defensa en
--    profundidad.
--  * NO se usa FORCE ROW LEVEL SECURITY para no bloquear al owner/servicio.
--
-- Idempotente: se puede correr varias veces.
-- ============================================================================

-- Tablas tenant (aisladas por clinic_id) ------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'roles','users','clinic_integrations','agent_configs','audit_logs',
    'platform_metrics','clinic_configs','clinic_schedules','unavailability_blocks',
    'policies','doctors','treatments','doctor_treatments','treatment_offers',
    'appointments','clinic_contacts','conversations','messages',
    'patient_sessions','metrics_events','clinic_knowledge_overrides'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS clinic_isolation ON public.%I;', t);
    EXECUTE format($f$
      CREATE POLICY clinic_isolation ON public.%I
        USING (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid)
        WITH CHECK (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);
    $f$, t);
  END LOOP;
END $$;

-- appointment_history: no tiene clinic_id; se aísla vía la cita padre ---------
ALTER TABLE public.appointment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinic_isolation ON public.appointment_history;
CREATE POLICY clinic_isolation ON public.appointment_history
  USING (
    appointment_id IN (
      SELECT id FROM public.appointments
      WHERE clinic_id = (auth.jwt() ->> 'clinic_id')::uuid
    )
  );

-- refresh_tokens: aislado por user_id (sub del JWT) --------------------------
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON public.refresh_tokens;
CREATE POLICY user_isolation ON public.refresh_tokens
  USING (user_id = (auth.jwt() ->> 'sub')::uuid);

-- SIN RLS (a propósito):
--   dental_entries  -> enciclopedia global, solo service_role
--   clinics         -> solo backend con service_role
-- ============================================================================

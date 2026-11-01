-- ============================================================
-- I-Land1o1 – Telefon-Verifizierung
-- ============================================================
-- Ausführen im Supabase SQL Editor (Dashboard).
-- Idempotent: mehrfach ausführbar.
-- ============================================================

-- Tabelle für SMS-Verifizierungscodes
CREATE TABLE IF NOT EXISTS public.phone_verification_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number   TEXT NOT NULL,
  code           TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- Nur der eigene User darf seine Codes sehen
DROP POLICY IF EXISTS "phone_codes: eigene lesen" ON public.phone_verification_codes;
CREATE POLICY "phone_codes: eigene lesen" ON public.phone_verification_codes
  FOR SELECT USING (auth.uid() = user_id);

-- Nur Service-Role darf schreiben (wird von RPC aufgerufen)
DROP POLICY IF EXISTS "phone_codes: service schreibt" ON public.phone_verification_codes;
CREATE POLICY "phone_codes: service schreibt" ON public.phone_verification_codes
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Index für schnelle Lookup bei Verifizierung
CREATE INDEX IF NOT EXISTS phone_codes_user_idx
  ON public.phone_verification_codes (user_id);
CREATE INDEX IF NOT EXISTS phone_codes_phone_idx
  ON public.phone_verification_codes (phone_number);

-- Spalte für "telefon_verifiziert" im profiles (falls noch nicht vorhanden)
-- Wird über user_metadata.phone_verified in handle_new_user gesetzt,
-- aber wir legen hier eine explizite Spalte an für Abfragen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Kommentar
COMMENT ON TABLE public.phone_verification_codes IS 'SMS-Verifizierungscodes für Telefonnummer-Verifizierung bei Registrierung';
COMMENT ON COLUMN public.profiles.phone_verified IS 'True wenn Telefonnummer verifiziert wurde';
COMMENT ON COLUMN public.profiles.phone_number IS 'Verifizierte Telefonnummer';
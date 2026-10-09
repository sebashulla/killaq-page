-- KILLAQ · 003 · Restaurar el libro de reclamaciones.
-- Ejecutar después de 001 y 002. Es idempotente y conserva registros existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.complaints_book (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  document_number TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  claim_type TEXT NOT NULL DEFAULT 'reclamo' CHECK (claim_type IN ('reclamo','queja')),
  order_reference TEXT,
  detail TEXT NOT NULL,
  request TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','answered','closed')),
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_complaints_book_created_at ON public.complaints_book(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_book_status ON public.complaints_book(status);
CREATE OR REPLACE FUNCTION public.touch_complaint_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS complaints_book_updated_at ON public.complaints_book;
CREATE TRIGGER complaints_book_updated_at BEFORE UPDATE ON public.complaints_book
  FOR EACH ROW EXECUTE FUNCTION public.touch_complaint_updated_at();
ALTER TABLE public.complaints_book ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cualquiera puede registrar reclamaciones" ON public.complaints_book;
DROP POLICY IF EXISTS "Solo admin gestiona reclamaciones" ON public.complaints_book;
CREATE POLICY "Cualquiera puede registrar reclamaciones" ON public.complaints_book FOR INSERT
  WITH CHECK (status = 'new' AND response IS NULL AND length(trim(full_name)) >= 2
    AND length(trim(document_number)) >= 4 AND length(trim(phone)) >= 7
    AND length(trim(detail)) >= 10 AND length(trim(request)) >= 5);
CREATE POLICY "Solo admin gestiona reclamaciones" ON public.complaints_book FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- SELECT se permite a nivel de tabla; RLS devuelve filas únicamente a administradores.
GRANT SELECT, INSERT ON public.complaints_book TO anon, authenticated;
GRANT UPDATE, DELETE ON public.complaints_book TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.complaints_book_id_seq TO anon, authenticated;
COMMIT;

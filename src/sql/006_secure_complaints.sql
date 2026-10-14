-- KILLAQ · 006 · Libro virtual seguro. Aplicar después de 001–005.
-- Manual, transaccional e idempotente. Conserva complaints_book y sus filas.
-- Cierra la inserción directa del navegador: requiere backend con service_role.
BEGIN;
ALTER TABLE public.complaints_book
  ADD COLUMN IF NOT EXISTS submission_id UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS provider_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS representative_name TEXT,
  ADD COLUMN IF NOT EXISTS representative_address TEXT,
  ADD COLUMN IF NOT EXISTS representative_phone TEXT,
  ADD COLUMN IF NOT EXISTS representative_email TEXT,
  ADD COLUMN IF NOT EXISTS item_type TEXT,
  ADD COLUMN IF NOT EXISTS item_description TEXT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS response_channel TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS calendar_version TEXT,
  ADD COLUMN IF NOT EXISTS retained_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.complaint_calendar_years (
  year INTEGER PRIMARY KEY, source TEXT NOT NULL, reviewed_on DATE NOT NULL
);
CREATE TABLE IF NOT EXISTS public.complaint_holidays (
  day DATE PRIMARY KEY, description TEXT NOT NULL
);
INSERT INTO public.complaint_calendar_years VALUES
  (2026,'DL 713 art. 6 y modificatorias; https://www.gob.pe/feriados','2026-10-09'),
  (2027,'DL 713 art. 6 y modificatorias; Semana Santa gregoriana; revisar nuevas normas','2026-10-09')
ON CONFLICT DO NOTHING;
INSERT INTO public.complaint_holidays(day,description)
SELECT (year::text || '-' || day)::date, description
FROM (VALUES (2026),(2027)) years(year)
CROSS JOIN (VALUES ('01-01','Año Nuevo'),('05-01','Día del Trabajo'),('06-07','Batalla de Arica / Bandera'),
 ('06-29','San Pedro y San Pablo'),('07-23','Fuerza Aérea'),('07-28','Fiestas Patrias'),('07-29','Fiestas Patrias'),
 ('08-06','Batalla de Junín'),('08-30','Santa Rosa'),('10-08','Angamos'),('11-01','Todos los Santos'),
 ('12-08','Inmaculada Concepción'),('12-09','Batalla de Ayacucho'),('12-25','Navidad')) dates(day,description)
ON CONFLICT DO NOTHING;
INSERT INTO public.complaint_holidays VALUES ('2026-04-02','Jueves Santo'),('2026-04-03','Viernes Santo'),
 ('2027-03-25','Jueves Santo'),('2027-03-26','Viernes Santo') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.complaint_events (
  id BIGSERIAL PRIMARY KEY, complaint_id BIGINT NOT NULL REFERENCES public.complaints_book(id),
  actor_id UUID, kind TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', evidence JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS complaint_events_case ON public.complaint_events(complaint_id,id);
CREATE TABLE IF NOT EXISTS public.complaint_outbox (
  id BIGSERIAL PRIMARY KEY, complaint_id BIGINT NOT NULL REFERENCES public.complaints_book(id),
  event_id BIGINT REFERENCES public.complaint_events(id), kind TEXT NOT NULL,
  to_email TEXT NOT NULL, payload JSONB NOT NULL, dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent')),
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ, provider_id TEXT, last_error TEXT, sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS complaint_outbox_pending ON public.complaint_outbox(status,next_attempt_at);
CREATE TABLE IF NOT EXISTS public.complaint_rate_limits (
  key TEXT NOT NULL, window_start TIMESTAMPTZ NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(key,window_start)
);

CREATE OR REPLACE FUNCTION public.complaint_due_date(received TIMESTAMPTZ)
RETURNS DATE LANGUAGE plpgsql SET search_path = public AS $$
DECLARE candidate DATE := (received AT TIME ZONE 'America/Lima')::date; days INTEGER := 0;
BEGIN
 WHILE days < 15 LOOP
  candidate := candidate + 1;
  IF NOT EXISTS(SELECT 1 FROM public.complaint_calendar_years y WHERE y.year=extract(year FROM candidate)::integer) THEN
   RAISE EXCEPTION 'CALENDAR_NOT_READY';
  END IF;
  IF extract(isodow FROM candidate) < 6 AND NOT EXISTS(SELECT 1 FROM public.complaint_holidays h WHERE h.day=candidate) THEN
   days := days + 1;
  END IF;
 END LOOP;
 RETURN candidate;
END $$;

CREATE OR REPLACE FUNCTION public.protect_complaint_original()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'No se elimina documentación desde la aplicación'; END IF;
 IF (to_jsonb(NEW) - ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at']) THEN
  RAISE EXCEPTION 'La solicitud original es inmutable; registrar una actuación';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS complaint_original_immutable ON public.complaints_book;
CREATE TRIGGER complaint_original_immutable BEFORE UPDATE OR DELETE ON public.complaints_book
 FOR EACH ROW EXECUTE FUNCTION public.protect_complaint_original();
CREATE OR REPLACE FUNCTION public.protect_complaint_event()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'El historial de actuaciones es inmutable'; END $$;
DROP TRIGGER IF EXISTS complaint_events_immutable ON public.complaint_events;
CREATE TRIGGER complaint_events_immutable BEFORE UPDATE OR DELETE ON public.complaint_events
 FOR EACH ROW EXECUTE FUNCTION public.protect_complaint_event();

CREATE OR REPLACE FUNCTION public.register_complaint(p_data JSONB,p_provider JSONB,p_submission UUID,
 p_hash TEXT,p_ip_hash TEXT,p_document_hash TEXT,p_team TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.complaints_book; receipt JSONB; received TIMESTAMPTZ := clock_timestamp();
 bucket TIMESTAMPTZ := date_trunc('hour',now()); hits INTEGER; rate_key TEXT;
BEGIN
 -- Serializar reintentos de una misma presentación. Las demás pueden ser concurrentes.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_submission::text,0));
 SELECT * INTO c FROM public.complaints_book WHERE submission_id=p_submission;
 IF FOUND THEN
  IF c.payload_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
 ELSE
  IF length(trim(coalesce(p_data->>'full_name',''))) = 0 OR length(trim(coalesce(p_data->>'detail',''))) = 0
   OR length(trim(coalesce(p_data->>'document_number',''))) = 0
   OR (coalesce(p_data->>'email','')='' AND coalesce(p_data->>'address','')='')
   OR p_data->>'claim_type' NOT IN ('reclamo','queja') OR p_data->>'item_type' NOT IN ('producto','servicio')
   OR p_data->>'response_channel' NOT IN ('email','carta') THEN RAISE EXCEPTION 'INVALID_COMPLAINT'; END IF;
  IF coalesce(p_provider->>'legalName','')='' OR coalesce(p_provider->>'address','')=''
    OR coalesce(p_provider->>'ruc','') !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'PROVIDER_NOT_READY'; END IF;
  FOREACH rate_key IN ARRAY ARRAY['ip:'||p_ip_hash,'document:'||p_document_hash] LOOP
   INSERT INTO public.complaint_rate_limits(key,window_start,count) VALUES(rate_key,bucket,1)
    ON CONFLICT(key,window_start) DO UPDATE SET count=complaint_rate_limits.count+1 RETURNING count INTO hits;
   IF hits > (CASE WHEN rate_key LIKE 'ip:%' THEN 30 ELSE 10 END) THEN RAISE EXCEPTION 'RATE_LIMIT'; END IF;
  END LOOP;
  INSERT INTO public.complaints_book(full_name,document_number,email,phone,address,claim_type,order_reference,detail,request,
   submission_id,payload_hash,provider_snapshot,document_type,is_minor,representative_name,representative_address,
   representative_phone,representative_email,item_type,item_description,amount,response_channel,due_date,calendar_version,retained_until,created_at)
  VALUES(p_data->>'full_name',p_data->>'document_number',nullif(p_data->>'email',''),coalesce(p_data->>'phone',''),nullif(p_data->>'address',''),
   p_data->>'claim_type',nullif(p_data->>'order_reference',''),p_data->>'detail',coalesce(p_data->>'request',''),p_submission,p_hash,p_provider,
   p_data->>'document_type',coalesce((p_data->>'is_minor')::boolean,false),p_data->>'representative_name',p_data->>'representative_address',
   p_data->>'representative_phone',p_data->>'representative_email',p_data->>'item_type',p_data->>'item_description',
   nullif(p_data->>'amount','')::numeric,p_data->>'response_channel',public.complaint_due_date(received),'PE-2026-2027-v1',received+interval '2 years',received)
   RETURNING * INTO c;
  INSERT INTO public.complaint_events(complaint_id,kind,body) VALUES(c.id,'received','Presentación virtual recibida');
  receipt := to_jsonb(c)-ARRAY['submission_id','payload_hash','response'];
  receipt := receipt || jsonb_build_object('sheet_number','KQ-'||extract(year FROM received AT TIME ZONE 'America/Lima')::text||'-'||lpad(c.id::text,greatest(9,length(c.id::text)),'0'));
  IF c.email IS NOT NULL THEN
   INSERT INTO public.complaint_outbox(complaint_id,kind,to_email,payload,dedupe_key)
    VALUES(c.id,'receipt',c.email,receipt,'receipt:'||c.id);
  END IF;
  INSERT INTO public.complaint_outbox(complaint_id,kind,to_email,payload,dedupe_key)
   VALUES(c.id,'team',p_team,jsonb_build_object('sheet_number',receipt->>'sheet_number','due_date',c.due_date),'team:'||c.id);
 END IF;
 receipt := (to_jsonb(c)-ARRAY['submission_id','payload_hash','response']) || jsonb_build_object('sheet_number',
  'KQ-'||extract(year FROM c.created_at AT TIME ZONE 'America/Lima')::text||'-'||lpad(c.id::text,greatest(9,length(c.id::text)),'0'),
  'email_status',CASE WHEN c.email IS NULL THEN 'not_requested' WHEN EXISTS(SELECT 1 FROM public.complaint_outbox WHERE complaint_id=c.id AND kind='receipt' AND status='sent') THEN 'accepted' ELSE 'pending' END);
 RETURN receipt;
END $$;

CREATE OR REPLACE FUNCTION public.record_complaint_action(p_id BIGINT,p_actor UUID,p_kind TEXT,p_body TEXT,p_evidence TEXT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.complaints_book; event BIGINT; proof JSONB := p_evidence::jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 IF p_kind NOT IN ('note','review','response','postal_response','close','delivery_evidence') OR length(trim(p_body))=0 OR length(p_body)>10000 OR length(coalesce(proof->>'reference',''))>2000 THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 SELECT * INTO c FROM public.complaints_book WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF c.status='closed' AND p_kind IN ('response','postal_response','review') THEN RAISE EXCEPTION 'CASE_CLOSED'; END IF;
 IF p_kind='response' AND (c.response_channel IS DISTINCT FROM 'email' OR c.email IS NULL) THEN RAISE EXCEPTION 'USE_REQUESTED_CHANNEL'; END IF;
 IF p_kind='postal_response' AND (c.response_channel IS DISTINCT FROM 'carta' OR length(trim(coalesce(proof->>'reference','')))=0
  OR coalesce(proof->>'communicated_at','')='') THEN RAISE EXCEPTION 'POSTAL_EVIDENCE_REQUIRED'; END IF;
 IF proof->>'communicated_at' IS NOT NULL AND (proof->>'communicated_at')::timestamptz > clock_timestamp() THEN RAISE EXCEPTION 'FUTURE_COMMUNICATION'; END IF;
 IF p_kind='delivery_evidence' AND length(trim(coalesce(proof->>'reference','')))=0 THEN RAISE EXCEPTION 'EVIDENCE_REQUIRED'; END IF;
 IF p_kind='close' AND (c.status IS DISTINCT FROM 'answered' OR EXISTS(SELECT 1 FROM public.complaint_outbox WHERE complaint_id=c.id AND kind='response' AND status<>'sent')) THEN RAISE EXCEPTION 'RESPONSE_REQUIRED'; END IF;
 INSERT INTO public.complaint_events(complaint_id,actor_id,kind,body,evidence)
  VALUES(p_id,p_actor,p_kind,p_body,proof) RETURNING id INTO event;
 IF p_kind='response' THEN
  INSERT INTO public.complaint_outbox(complaint_id,event_id,kind,to_email,payload,dedupe_key)
   VALUES(p_id,event,'response',c.email,jsonb_build_object('body',p_body,'sheet_number','KQ-'||extract(year FROM c.created_at AT TIME ZONE 'America/Lima')::text||'-'||lpad(c.id::text,greatest(9,length(c.id::text)),'0')),'response:'||event);
 END IF;
 UPDATE public.complaints_book SET status=CASE WHEN p_kind='close' THEN 'closed' WHEN p_kind='postal_response' THEN 'answered'
  WHEN p_kind IN ('review','response') THEN 'in_review' ELSE status END WHERE id=p_id;
 RETURN event;
END $$;

CREATE OR REPLACE FUNCTION public.lease_complaint_mail(p_limit INTEGER,p_case BIGINT DEFAULT NULL)
RETURNS SETOF public.complaint_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.complaint_outbox SET status='processing',locked_until=now()+interval '10 minutes',attempts=attempts+1
 WHERE id IN (SELECT id FROM public.complaint_outbox WHERE next_attempt_at<=now() AND (p_case IS NULL OR complaint_id=p_case)
  AND (status='pending' OR (status='processing' AND locked_until<now())) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),20)) RETURNING *;
$$;
CREATE OR REPLACE FUNCTION public.complete_complaint_mail(p_id BIGINT,p_attempt INTEGER,p_provider_id TEXT,p_error TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mail public.complaint_outbox;
BEGIN
 SELECT * INTO mail FROM public.complaint_outbox WHERE id=p_id AND status='processing' AND attempts=p_attempt FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STALE_LEASE'; END IF;
 IF p_error IS NULL AND length(coalesce(p_provider_id,''))>0 THEN
  UPDATE public.complaint_outbox SET status='sent',provider_id=p_provider_id,sent_at=clock_timestamp(),locked_until=NULL,last_error=NULL WHERE id=p_id;
  INSERT INTO public.complaint_events(complaint_id,kind,body,evidence) VALUES(mail.complaint_id,'mail_accepted',
   'Servicio de correo aceptó '||mail.kind||'; entrega/lectura no certificadas',jsonb_build_object('provider_id',p_provider_id,'outbox_id',mail.id,'event_id',mail.event_id));
  IF mail.kind='response' THEN UPDATE public.complaints_book SET status='answered' WHERE id=mail.complaint_id AND status<>'closed'; END IF;
 ELSE
  UPDATE public.complaint_outbox SET status='pending',locked_until=NULL,last_error=left(coalesce(p_error,'SEND_FAILED'),100),
   next_attempt_at=now()+make_interval(mins=>least(240,5*attempts)) WHERE id=p_id;
  INSERT INTO public.complaint_events(complaint_id,kind,body,evidence) VALUES(mail.complaint_id,'mail_failed',
   'Correo pendiente de reintento',jsonb_build_object('outbox_id',mail.id,'attempt',mail.attempts));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.enqueue_complaint_reminders(p_team TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted INTEGER;
BEGIN
 INSERT INTO public.complaint_outbox(complaint_id,kind,to_email,payload,dedupe_key)
 SELECT id,'reminder',p_team,jsonb_build_object('id',id,'due_date',due_date,'status',status),
  'reminder:'||id||':'||(now() AT TIME ZONE 'America/Lima')::date FROM public.complaints_book
 WHERE status IN ('new','in_review') AND (due_date IS NULL OR due_date <= (now() AT TIME ZONE 'America/Lima')::date+7)
 ON CONFLICT(dedupe_key) DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 DELETE FROM public.complaint_rate_limits WHERE window_start<now()-interval '7 days';
 RETURN inserted;
END $$;

-- No inventar una identidad, fecha de vencimiento o historial para hojas antiguas.
-- El admin debe revisar las filas legacy (provider_snapshot / due_date nulos).
DROP POLICY IF EXISTS "Cualquiera puede registrar reclamaciones" ON public.complaints_book;
DROP POLICY IF EXISTS "Solo admin gestiona reclamaciones" ON public.complaints_book;
DROP POLICY IF EXISTS complaints_admin_read ON public.complaints_book;
CREATE POLICY complaints_admin_read ON public.complaints_book FOR SELECT TO authenticated USING(public.is_admin());
-- Impide reabrir escrituras de navegador si por error se reejecuta la migración 003.
DROP POLICY IF EXISTS complaints_no_anon_read ON public.complaints_book;
CREATE POLICY complaints_no_anon_read ON public.complaints_book AS RESTRICTIVE FOR SELECT TO anon USING(false);
DROP POLICY IF EXISTS complaints_no_browser_insert ON public.complaints_book;
CREATE POLICY complaints_no_browser_insert ON public.complaints_book AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(false);
DROP POLICY IF EXISTS complaints_no_browser_update ON public.complaints_book;
CREATE POLICY complaints_no_browser_update ON public.complaints_book AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS complaints_no_browser_delete ON public.complaints_book;
CREATE POLICY complaints_no_browser_delete ON public.complaints_book AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);
REVOKE ALL ON public.complaints_book,public.complaint_events,public.complaint_outbox,
 public.complaint_rate_limits,public.complaint_holidays,public.complaint_calendar_years FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.complaints_book_id_seq FROM PUBLIC,anon,authenticated;
ALTER TABLE public.complaint_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_calendar_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS complaint_events_admin_read ON public.complaint_events;
CREATE POLICY complaint_events_admin_read ON public.complaint_events FOR SELECT TO authenticated USING(public.is_admin());
DROP POLICY IF EXISTS complaint_outbox_admin_read ON public.complaint_outbox;
CREATE POLICY complaint_outbox_admin_read ON public.complaint_outbox FOR SELECT TO authenticated USING(public.is_admin());
GRANT SELECT ON public.complaints_book,public.complaint_events,public.complaint_outbox TO authenticated;
GRANT ALL ON public.complaints_book,public.complaint_events,public.complaint_outbox,public.complaint_rate_limits,
 public.complaint_holidays,public.complaint_calendar_years TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.complaints_book_id_seq,public.complaint_events_id_seq,public.complaint_outbox_id_seq TO service_role;
REVOKE ALL ON FUNCTION public.register_complaint(JSONB,JSONB,UUID,TEXT,TEXT,TEXT,TEXT),
 public.record_complaint_action(BIGINT,UUID,TEXT,TEXT,TEXT),public.lease_complaint_mail(INTEGER,BIGINT),
 public.complete_complaint_mail(BIGINT,INTEGER,TEXT,TEXT),public.enqueue_complaint_reminders(TEXT),public.complaint_due_date(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_complaint(JSONB,JSONB,UUID,TEXT,TEXT,TEXT,TEXT),
 public.record_complaint_action(BIGINT,UUID,TEXT,TEXT,TEXT),public.lease_complaint_mail(INTEGER,BIGINT),
 public.complete_complaint_mail(BIGINT,INTEGER,TEXT,TEXT),public.enqueue_complaint_reminders(TEXT),public.complaint_due_date(TIMESTAMPTZ) TO service_role;
COMMIT;

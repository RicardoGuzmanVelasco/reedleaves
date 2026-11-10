BEGIN;

CREATE TABLE IF NOT EXISTS public.app_roles (
  id TEXT PRIMARY KEY CHECK(length(btrim(id)) BETWEEN 1 AND 80),
  name_es TEXT NOT NULL CHECK(length(btrim(name_es)) > 0),
  name_en TEXT NOT NULL CHECK(length(btrim(name_en)) > 0)
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id TEXT NOT NULL REFERENCES public.accounts(user_id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES public.app_roles(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES public.accounts(user_id) ON DELETE SET NULL,
  PRIMARY KEY(user_id,role_id)
);
CREATE INDEX IF NOT EXISTS user_roles_by_role ON public.user_roles(role_id,user_id);
INSERT INTO public.app_roles(id,name_es,name_en) VALUES ('archivist','Archivista','Archivist')
  ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_roles(user_id,role_id)
  SELECT user_id,'archivist' FROM public.accounts WHERE lower(username)='ricardo'
  ON CONFLICT(user_id,role_id) DO NOTHING;

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.app_roles,public.user_roles FROM anon,authenticated;

COMMIT;

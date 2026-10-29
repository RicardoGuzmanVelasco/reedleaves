CREATE TABLE public.reader_known_interests (
  user_id TEXT NOT NULL REFERENCES public.accounts(user_id) ON DELETE CASCADE,
  interest_id TEXT NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,interest_id)
);
ALTER TABLE public.reader_known_interests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reader_interest_knowledge_visits (
  user_id TEXT NOT NULL REFERENCES public.accounts(user_id) ON DELETE CASCADE,
  visit_id TEXT NOT NULL CHECK(length(visit_id)=36),
  interest_ids TEXT NOT NULL,
  PRIMARY KEY(user_id,visit_id)
);
ALTER TABLE public.reader_interest_knowledge_visits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.reader_known_interests,public.reader_interest_knowledge_visits FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.reader_known_interests,public.reader_interest_knowledge_visits FROM authenticated;
  END IF;
END $$;

INSERT INTO public.reader_known_interests(user_id,interest_id)
SELECT accounts.user_id,genres.id FROM public.accounts CROSS JOIN public.genres;

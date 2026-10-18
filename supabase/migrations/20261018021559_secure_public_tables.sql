-- Reedleaves authenticates accounts in its Node server, not through Supabase Auth.
-- The browser must not access these tables through the Supabase Data API. All
-- application reads and writes go through the server's privileged DATABASE_URL,
-- where server/auth.mjs and the repositories enforce account ownership.

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_reading ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_version_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genre_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaf_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petal_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reader_display_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reed_schema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated access is needed: the UI uses the Reedleaves HTTP API,
-- not PostgREST. RLS without a policy is intentional defense in depth.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

-- Avoid reintroducing Data API grants when future tables are created by the
-- postgres owner (the role used for this project's schema and Supabase SQL work).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC globally by default.
-- Supabase also has project-level API-role grants for public-schema functions.
-- No app RPC exists; leave future RPCs private unless a deliberate grant is added.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;

-- Private app state. Reads and writes go through the authenticated Reedleaves API.
ALTER TABLE public.reader_interest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reader_interest_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.reader_interest_preferences FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.reader_interest_settings FROM anon, authenticated;

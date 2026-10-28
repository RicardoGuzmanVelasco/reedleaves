-- Private app state. Reads and writes go through the authenticated Reedleaves API.
ALTER TABLE public.reader_language_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.reader_language_preferences FROM anon, authenticated;

-- Reader sort preferences are private app state. The browser uses the
-- Reedleaves HTTP API, never Supabase Data API access to this table.
ALTER TABLE public.reader_book_sort_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.reader_book_sort_preferences FROM anon, authenticated;

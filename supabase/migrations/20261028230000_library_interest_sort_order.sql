-- Extend the existing private library-sort preference without adding an API field.
ALTER TABLE public.reader_book_sort_preferences
  DROP CONSTRAINT reader_book_sort_preferences_sort_order_check;
ALTER TABLE public.reader_book_sort_preferences
  ADD CONSTRAINT reader_book_sort_preferences_sort_order_check
  CHECK (sort_order IN ('recent','alphabetical','interests'));

ALTER TABLE public.reed_schema DROP CONSTRAINT reed_schema_version_check;
UPDATE public.reed_schema SET version=41;
ALTER TABLE public.reed_schema ADD CONSTRAINT reed_schema_version_check CHECK (version=41);

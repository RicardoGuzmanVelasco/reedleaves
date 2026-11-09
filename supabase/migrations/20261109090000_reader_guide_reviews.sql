BEGIN;

CREATE TABLE IF NOT EXISTS public.reading_guide_reviews(
  card_id TEXT PRIMARY KEY REFERENCES public.cards(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT CHECK(rejection_reason IS NULL OR length(btrim(rejection_reason)) BETWEEN 1 AND 1000),
  CHECK((status='pending' AND reviewed_at IS NULL AND rejection_reason IS NULL) OR
        (status='approved' AND reviewed_at IS NOT NULL AND rejection_reason IS NULL) OR
        (status='rejected' AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS reading_guide_reviews_by_status
  ON public.reading_guide_reviews(status,submitted_at,card_id);
ALTER TABLE public.reading_guide_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.reading_guide_reviews FROM anon,authenticated;

COMMIT;

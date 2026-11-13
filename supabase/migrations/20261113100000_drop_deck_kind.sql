DO $$
DECLARE found RECORD;
BEGIN
  FOR found IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.decks'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ~ '\mkind\M' LOOP
    EXECUTE format('ALTER TABLE public.decks DROP CONSTRAINT %I', found.conname);
  END LOOP;
END $$;
ALTER TABLE public.decks DROP COLUMN kind;
ALTER TABLE public.decks ADD CONSTRAINT decks_owner_limit CHECK (contribution_policy <> 'owner' OR max_cards_per_contributor IS NULL);

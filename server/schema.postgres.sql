CREATE TABLE reed_schema(version INTEGER PRIMARY KEY CHECK(version = 4));
INSERT INTO reed_schema VALUES (4);

CREATE TABLE genres(id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0));
CREATE TABLE genre_translations(
  genre_id TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  name TEXT NOT NULL CHECK(length(btrim(name)) > 0), PRIMARY KEY(genre_id,language)
);
CREATE TABLE books(
  id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0), author TEXT NOT NULL CHECK(length(btrim(author)) > 0),
  original_title TEXT NOT NULL CHECK(length(btrim(original_title)) > 0),
  original_language TEXT NOT NULL CHECK(length(original_language) BETWEEN 2 AND 35),
  position INTEGER NOT NULL UNIQUE CHECK(position > 0),
  editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK(editorial_status IN ('draft','reviewed')),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE book_links(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('amazon','goodreads')),
  url TEXT NOT NULL CHECK(url LIKE 'https://%' AND length(btrim(url)) > 8), PRIMARY KEY(book_id,platform)
);
CREATE TABLE book_translations(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(btrim(title)) > 0), short_title TEXT NOT NULL CHECK(length(btrim(short_title)) > 0),
  description TEXT NOT NULL CHECK(length(btrim(description)) > 0), editorial_note TEXT NOT NULL CHECK(length(btrim(editorial_note)) > 0),
  PRIMARY KEY(book_id,language)
);
CREATE TABLE book_genres(
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, genre_id TEXT NOT NULL REFERENCES genres(id),
  PRIMARY KEY(book_id,genre_id)
);
CREATE INDEX book_genres_by_genre ON book_genres(genre_id,book_id);
CREATE TABLE sources(
  id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(btrim(title)) > 0), url TEXT NOT NULL CHECK(url LIKE 'https://%'),
  UNIQUE(book_id,url), UNIQUE(id,book_id)
);
CREATE TABLE users(
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL CHECK(length(btrim(display_name)) > 0),
  can_create_decks SMALLINT NOT NULL DEFAULT 0 CHECK(can_create_decks IN (0,1)), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);

CREATE TABLE accounts(
  user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT NOT NULL UNIQUE CHECK(length(username) BETWEEN 3 AND 32),
  password_hash TEXT NOT NULL, time_zone TEXT NOT NULL, language TEXT NOT NULL CHECK(language IN ('es','en','fr'))
);
CREATE TABLE reader_display_preferences (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  show_original_titles INTEGER NOT NULL CHECK(show_original_titles IN (0,1))
);
CREATE TABLE sessions(
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL, expires_at BIGINT NOT NULL
);
CREATE INDEX sessions_by_user ON sessions(user_id);
CREATE TABLE auth_limits(bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at BIGINT NOT NULL);
CREATE TABLE decks(
  id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id), creator_user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35), is_recommended SMALLINT NOT NULL DEFAULT 0 CHECK(is_recommended IN (0,1)),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(id,book_id)
);
CREATE INDEX decks_by_book ON decks(book_id);
CREATE UNIQUE INDEX one_recommendation_per_book ON decks(book_id) WHERE is_recommended = 1;
CREATE TABLE deck_versions(
  id TEXT PRIMARY KEY, deck_id TEXT NOT NULL, book_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK(editorial_status IN ('draft','reviewed')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(deck_id,version), UNIQUE(id,book_id),
  FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id)
);
CREATE TABLE deck_version_translations(
  version_id TEXT NOT NULL REFERENCES deck_versions(id), language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(btrim(title)) > 0), description TEXT NOT NULL CHECK(length(btrim(description)) > 0),
  editorial_note TEXT NOT NULL CHECK(length(btrim(editorial_note)) > 0), PRIMARY KEY(version_id,language)
);
CREATE TABLE cards(
  id TEXT PRIMARY KEY CHECK(length(btrim(id)) > 0), version_id TEXT NOT NULL, book_id TEXT NOT NULL, parent_id TEXT,
  position INTEGER NOT NULL CHECK(position > 0), source_id TEXT, is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)), UNIQUE(id,version_id),
  FOREIGN KEY(version_id,book_id) REFERENCES deck_versions(id,book_id),
  FOREIGN KEY(parent_id,version_id) REFERENCES cards(id,version_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(source_id,book_id) REFERENCES sources(id,book_id), CHECK(parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX root_order ON cards(version_id,position) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX sibling_order ON cards(version_id,parent_id,position) WHERE parent_id IS NOT NULL;
CREATE INDEX cards_by_version ON cards(version_id,parent_id,position);
CREATE TABLE card_translations(
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
  title TEXT NOT NULL CHECK(length(btrim(title)) > 0), body TEXT NOT NULL CHECK(length(btrim(body)) > 0), PRIMARY KEY(card_id,language)
);
CREATE TABLE deck_votes(
  user_id TEXT NOT NULL REFERENCES users(id), deck_id TEXT NOT NULL REFERENCES decks(id), value INTEGER NOT NULL CHECK(value IN (-1,1)),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,deck_id)
);
CREATE INDEX votes_by_deck ON deck_votes(deck_id,value);
CREATE TABLE book_reading(
  user_id TEXT NOT NULL REFERENCES users(id), book_id TEXT NOT NULL REFERENCES books(id),
  status TEXT NOT NULL CHECK(status IN ('reading','read')), PRIMARY KEY(user_id,book_id)
);
CREATE TABLE reviews(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), version_id TEXT NOT NULL REFERENCES deck_versions(id),
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP,
  UNIQUE(user_id,version_id), UNIQUE(id,user_id,version_id), CHECK(completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX reviews_by_version ON reviews(version_id,user_id);
CREATE TABLE leaf_wallets(
  user_id TEXT PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL CHECK(balance BETWEEN 0 AND 3),
  last_accrual_day TEXT NOT NULL CHECK(last_accrual_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(last_accrual_day,'YYYY-MM-DD'),'YYYY-MM-DD') = last_accrual_day)
);
CREATE TABLE review_unlocks(
  rowid BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE, review_id TEXT NOT NULL, user_id TEXT NOT NULL, version_id TEXT NOT NULL,
  card_id TEXT NOT NULL, local_day TEXT NOT NULL CHECK(local_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(local_day,'YYYY-MM-DD'),'YYYY-MM-DD') = local_day),
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(review_id,card_id),
  FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
  FOREIGN KEY(card_id,version_id) REFERENCES cards(id,version_id)
);
CREATE TABLE studies(rowid BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), version_id TEXT NOT NULL REFERENCES deck_versions(id), PRIMARY KEY(user_id,version_id));
CREATE TABLE deck_selections(
  user_id TEXT NOT NULL REFERENCES users(id), book_id TEXT NOT NULL REFERENCES books(id), version_id TEXT NOT NULL,
  PRIMARY KEY(user_id,book_id), FOREIGN KEY(version_id,book_id) REFERENCES deck_versions(id,book_id)
);
CREATE TABLE review_positions(
  review_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, version_id TEXT NOT NULL, card_id TEXT NOT NULL,
  FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
  FOREIGN KEY(review_id,card_id) REFERENCES review_unlocks(review_id,card_id)
);
CREATE TABLE reader_filters(
  user_id TEXT NOT NULL REFERENCES users(id), source TEXT NOT NULL CHECK(source IN ('reading','read','reviewing','reviewed','interests','all')),
  PRIMARY KEY(user_id,source)
);
CREATE TABLE reader_interests(user_id TEXT NOT NULL REFERENCES users(id), genre_id TEXT NOT NULL REFERENCES genres(id), PRIMARY KEY(user_id,genre_id));
CREATE TABLE daily_ideas(user_id TEXT NOT NULL REFERENCES users(id), local_day TEXT NOT NULL, card_id TEXT NOT NULL REFERENCES cards(id), PRIMARY KEY(user_id,local_day));

CREATE FUNCTION reed_check_deck_author() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE((SELECT can_create_decks FROM users WHERE id=NEW.creator_user_id),0) <> 1 THEN
    RAISE EXCEPTION 'Deck creation permission required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_deck_author_insert BEFORE INSERT ON decks FOR EACH ROW EXECUTE FUNCTION reed_check_deck_author();
CREATE FUNCTION reed_keep_deck_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.creator_user_id IS DISTINCT FROM OLD.creator_user_id OR NEW.book_id IS DISTINCT FROM OLD.book_id OR NEW.language IS DISTINCT FROM OLD.language THEN
    RAISE EXCEPTION 'Deck ownership is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER keep_deck_owner BEFORE UPDATE ON decks FOR EACH ROW EXECUTE FUNCTION reed_keep_deck_owner();

CREATE FUNCTION reed_check_card_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors(id,parent_id) AS (
      SELECT id,parent_id FROM cards WHERE id=NEW.parent_id AND version_id=NEW.version_id
      UNION SELECT c.id,c.parent_id FROM cards c JOIN ancestors a ON c.id=a.parent_id AND c.version_id=NEW.version_id
    ) SELECT 1 FROM ancestors WHERE id=NEW.id
  ) THEN RAISE EXCEPTION 'Card tree cycle'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER no_card_cycles_insert BEFORE INSERT ON cards FOR EACH ROW EXECUTE FUNCTION reed_check_card_cycle();
CREATE TRIGGER no_card_cycles_update BEFORE UPDATE OF parent_id ON cards FOR EACH ROW EXECUTE FUNCTION reed_check_card_cycle();

CREATE FUNCTION reed_check_unlock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM cards c WHERE c.id=NEW.card_id AND c.version_id=NEW.version_id AND c.parent_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM review_unlocks u WHERE u.review_id=NEW.review_id AND u.card_id=c.parent_id)) THEN
    RAISE EXCEPTION 'Parent card is locked';
  END IF;
  IF EXISTS(SELECT 1 FROM cards c JOIN cards sibling ON sibling.version_id=c.version_id AND sibling.parent_id IS NOT DISTINCT FROM c.parent_id AND sibling.position<c.position AND (c.parent_id IS NOT NULL OR sibling.is_quote=c.is_quote)
    WHERE c.id=NEW.card_id AND c.version_id=NEW.version_id AND NOT EXISTS(SELECT 1 FROM review_unlocks u WHERE u.review_id=NEW.review_id AND u.card_id=sibling.id)) THEN
    RAISE EXCEPTION 'Previous sibling is locked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER spend_unlock_leaf BEFORE INSERT ON review_unlocks FOR EACH ROW EXECUTE FUNCTION reed_check_unlock();

CREATE FUNCTION reed_complete_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE reviews SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP)
  WHERE id=NEW.review_id AND (SELECT count(*) FROM review_unlocks WHERE review_id=NEW.review_id)=(SELECT count(*) FROM cards WHERE version_id=NEW.version_id);
  RETURN NEW;
END $$;
CREATE TRIGGER complete_review AFTER INSERT ON review_unlocks FOR EACH ROW EXECUTE FUNCTION reed_complete_review();

CREATE FUNCTION reed_freeze_cards() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE version_status TEXT;
BEGIN
  SELECT status INTO version_status FROM deck_versions WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  IF version_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Published content is immutable; create a new version'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER freeze_cards_insert BEFORE INSERT ON cards FOR EACH ROW EXECUTE FUNCTION reed_freeze_cards();
CREATE TRIGGER freeze_cards_update BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION reed_freeze_cards();
CREATE TRIGGER freeze_cards_delete BEFORE DELETE ON cards FOR EACH ROW EXECUTE FUNCTION reed_freeze_cards();

CREATE FUNCTION reed_freeze_card_translation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE card_version TEXT; version_status TEXT;
BEGIN
  SELECT version_id INTO card_version FROM cards WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.card_id ELSE NEW.card_id END;
  SELECT status INTO version_status FROM deck_versions WHERE id=card_version;
  IF version_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Published content is immutable; create a new version'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER freeze_card_translation_insert BEFORE INSERT ON card_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_card_translation();
CREATE TRIGGER freeze_card_translation_update BEFORE UPDATE ON card_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_card_translation();
CREATE TRIGGER freeze_card_translation_delete BEFORE DELETE ON card_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_card_translation();

CREATE FUNCTION reed_freeze_version_translation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE version_status TEXT;
BEGIN
  SELECT status INTO version_status FROM deck_versions WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  IF version_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Published content is immutable; create a new version'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER freeze_version_translation_insert BEFORE INSERT ON deck_version_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_version_translation();
CREATE TRIGGER freeze_version_translation_update BEFORE UPDATE ON deck_version_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_version_translation();
CREATE TRIGGER freeze_version_translation_delete BEFORE DELETE ON deck_version_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_version_translation();

CREATE FUNCTION reed_freeze_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' AND (NEW.id <> OLD.id OR NEW.deck_id <> OLD.deck_id OR NEW.book_id <> OLD.book_id OR NEW.version <> OLD.version OR NEW.status='draft' OR NEW.editorial_status <> OLD.editorial_status OR NEW.created_at <> OLD.created_at) THEN
    RAISE EXCEPTION 'Published version is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER freeze_version BEFORE UPDATE ON deck_versions FOR EACH ROW EXECUTE FUNCTION reed_freeze_version();
CREATE FUNCTION reed_keep_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Published version is immutable'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER keep_published_version BEFORE DELETE ON deck_versions FOR EACH ROW EXECUTE FUNCTION reed_keep_published_version();

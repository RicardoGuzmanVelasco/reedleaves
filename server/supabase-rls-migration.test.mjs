import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {FEEDBACK_MESSAGE_MAX_LENGTH,FEEDBACK_PAGE_MAX_LENGTH,USERNAME_MIN_LENGTH,USERNAME_MAX_LENGTH} from "../app/core.mjs";

const schema = await readFile(new URL("./fixtures/migrations/postgres-v18.sql",import.meta.url),"utf8");
const migration = (await readFile(new URL("../supabase/migrations/20261018021559_secure_public_tables.sql",import.meta.url),"utf8"))
  .replaceAll("public.review_cards","public.practice_cards")
  .replaceAll("public.review_positions","public.practice_positions")
  .replaceAll("public.reviews","public.practices");
const bookSortMigration=await readFile(new URL("../supabase/migrations/20261028000000_secure_reader_book_sort_preferences.sql",import.meta.url),"utf8");
const readerInterestMigration=await readFile(new URL("../supabase/migrations/20261028204846_reader_interest_preferences.sql",import.meta.url),"utf8");
const readerLanguageMigration=await readFile(new URL("../supabase/migrations/20261029000000_secure_reader_language_preferences.sql",import.meta.url),"utf8");
const cleanPostgresSchema=(await readFile(new URL("./schema.postgres.sql",import.meta.url),"utf8"))
  .replaceAll("__USERNAME_MIN_LENGTH__",String(USERNAME_MIN_LENGTH))
  .replaceAll("__USERNAME_MAX_LENGTH__",String(USERNAME_MAX_LENGTH))
  .replaceAll("__FEEDBACK_MESSAGE_MAX_LENGTH__",String(FEEDBACK_MESSAGE_MAX_LENGTH))
  .replaceAll("__FEEDBACK_PAGE_MAX_LENGTH__",String(FEEDBACK_PAGE_MAX_LENGTH));

test("Fresh PostgreSQL schema revokes default Data API grants for private reader preferences",async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
  await db.exec(cleanPostgresSchema);
  const state=await db.query(`SELECT c.relname,c.relrowsecurity AS rls,
      has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
      has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('reader_book_sort_preferences','reader_interest_preferences','reader_interest_settings','reader_language_preferences')
    ORDER BY c.relname`);
  assert.deepEqual(state.rows,[
    {relname:"reader_book_sort_preferences",rls:true,anon_select:false,authenticated_update:false},
    {relname:"reader_interest_preferences",rls:true,anon_select:false,authenticated_update:false},
    {relname:"reader_interest_settings",rls:true,anon_select:false,authenticated_update:false},
    {relname:"reader_language_preferences",rls:true,anon_select:false,authenticated_update:false}
  ]);
});

test("Supabase migration blocks Data API roles while preserving privileged app and admin access",async t=>{
  const db = new PGlite();
  t.after(()=>db.close());

  await db.exec(schema);
  await db.exec(`CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon,authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`);
  await db.exec(migration);
  await db.exec(`CREATE TABLE public.reader_book_sort_preferences (
      user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
      sort_order TEXT NOT NULL CHECK(sort_order IN ('recent','alphabetical')));
    CREATE TABLE public.reader_interest_preferences (
      user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
      interest_id TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
      preference TEXT NOT NULL CHECK(preference IN ('interested','not_interested')),
      position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 5),
      PRIMARY KEY(user_id,interest_id), UNIQUE(user_id,preference,position));
    CREATE TABLE public.reader_interest_settings (
      user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK(revision > 0),
      configured_at TIMESTAMPTZ NOT NULL,
      initial_opportunity_closed_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE public.reader_language_preferences (
      user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
      languages TEXT NOT NULL, configured BOOLEAN NOT NULL, revision INTEGER NOT NULL CHECK(revision>=0));
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon,authenticated;`);
  await db.exec(bookSortMigration);
  await db.exec(readerInterestMigration);
  await db.exec(readerLanguageMigration);

  const tableState = await db.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS without_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')`);
  assert.deepEqual(tableState.rows,[{total:38,without_rls:0}]);

  const directAccess = await db.query(`SELECT
      has_table_privilege('anon','public.accounts','SELECT') AS anon_select,
      has_table_privilege('authenticated','public.accounts','UPDATE') AS authenticated_update,
      has_table_privilege('anon','public.sessions','DELETE') AS anon_delete,
      has_table_privilege('anon','public.practice_sessions','SELECT') AS anon_practice_select,
      has_table_privilege('anon','public.reader_book_sort_preferences','SELECT') AS anon_sort_select,
      has_table_privilege('authenticated','public.reader_book_sort_preferences','UPDATE') AS authenticated_sort_update,
      has_table_privilege('anon','public.reader_interest_preferences','SELECT') AS anon_interest_select,
      has_table_privilege('authenticated','public.reader_interest_settings','UPDATE') AS authenticated_interest_update,
      has_table_privilege('anon','public.reader_language_preferences','SELECT') AS anon_language_select,
      has_table_privilege('authenticated','public.reader_language_preferences','UPDATE') AS authenticated_language_update`);
  assert.deepEqual(directAccess.rows,[{anon_select:false,authenticated_update:false,anon_delete:false,anon_practice_select:false,anon_sort_select:false,authenticated_sort_update:false,anon_interest_select:false,authenticated_interest_update:false,anon_language_select:false,authenticated_language_update:false}]);

  const functionAccess = await db.query(`SELECT count(*)::int AS functions,
      count(*) FILTER (WHERE p.prorettype='trigger'::regtype AND EXISTS (
        SELECT 1 FROM pg_trigger t WHERE t.tgfoid=p.oid AND NOT t.tgisinternal
      ))::int AS trigger_functions,
      count(*) FILTER (WHERE has_function_privilege('public',p.oid,'EXECUTE'))::int AS public_exec,
      count(*) FILTER (WHERE has_function_privilege('anon',p.oid,'EXECUTE'))::int AS anon_exec,
      count(*) FILTER (WHERE has_function_privilege('authenticated',p.oid,'EXECUTE'))::int AS authenticated_exec,
      count(*) FILTER (WHERE has_function_privilege('service_role',p.oid,'EXECUTE'))::int AS service_exec
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'reed_%'`);
  assert.deepEqual(functionAccess.rows,[{functions:9,trigger_functions:9,public_exec:0,anon_exec:0,authenticated_exec:0,service_exec:0}]);

  await db.exec(`INSERT INTO public.users(id,display_name,can_create_decks) VALUES ('reader-1','reader',1);
    INSERT INTO public.accounts(user_id,username,password_hash,time_zone,language)
      VALUES ('reader-1','reader','hash','Europe/Madrid','es');
    INSERT INTO public.genres(id) VALUES ('society');
    INSERT INTO public.reader_book_sort_preferences(user_id,sort_order) VALUES ('reader-1','alphabetical');
    INSERT INTO public.reader_interest_preferences(user_id,interest_id,preference,position) VALUES ('reader-1','society','interested',1);
    INSERT INTO public.reader_interest_settings(user_id,revision,configured_at,initial_opportunity_closed_at)
      VALUES ('reader-1',1,'2026-10-28T12:00:00Z','2026-10-28T12:00:00Z');
    INSERT INTO public.reader_language_preferences(user_id,languages,configured,revision) VALUES ('reader-1','["en","es"]',false,0);
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.accounts,public.reader_book_sort_preferences,public.reader_interest_preferences,public.reader_interest_settings,public.reader_language_preferences TO anon,authenticated;`);

  for (const role of ["anon","authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    const visible = await db.query("SELECT count(*)::int AS count FROM public.accounts");
    assert.equal(visible.rows[0].count,0,`${role} must not read accounts even if a grant is reintroduced`);
    const sortVisible=await db.query("SELECT count(*)::int AS count FROM public.reader_book_sort_preferences");
    assert.equal(sortVisible.rows[0].count,0,`${role} must not read private sort preferences even if a grant is reintroduced`);
    for (const table of ["reader_interest_preferences","reader_interest_settings","reader_language_preferences"]) {
      const visible=await db.query(`SELECT count(*)::int AS count FROM public.${table}`);
      assert.equal(visible.rows[0].count,0,`${role} must not read ${table} even if a grant is reintroduced`);
    }
    await assert.rejects(db.query(`INSERT INTO public.accounts(user_id,username,password_hash,time_zone,language)
      VALUES ('${role}-user','${role}user','hash','Europe/Madrid','es')`));
    await assert.rejects(db.query(`INSERT INTO public.reader_book_sort_preferences(user_id,sort_order) VALUES ('${role}-user','recent')`));
    await db.exec("RESET ROLE");
  }

  // DATABASE_URL and SQL Editor use a privileged database role, so app-owned
  // writes and operator maintenance remain available despite RLS.
  const privileged = await db.query("SELECT count(*)::int AS count FROM public.accounts");
  assert.equal(privileged.rows[0].count,1);
  await db.query("UPDATE public.accounts SET language='en' WHERE user_id='reader-1'");
  assert.equal((await db.query("SELECT language FROM public.accounts WHERE user_id='reader-1'")).rows[0].language,"en");

  // The app's privileged connection can still use each trigger in the CRUD
  // paths: authoring and card/version immutability.
  await db.exec(`INSERT INTO public.books(id,author,original_title,original_language,position)
      VALUES ('book-1','author','Title','en',1);
    INSERT INTO public.decks(id,book_id,creator_user_id,language)
      VALUES ('deck-1','book-1','reader-1','en');
    INSERT INTO public.deck_versions(id,deck_id,book_id,version)
      VALUES ('version-1','deck-1','book-1',1);
    INSERT INTO public.deck_version_translations(version_id,language,title,description,editorial_note)
      VALUES ('version-1','en','Deck','Description','Note');
    INSERT INTO public.cards(id,version_id,book_id,position)
      VALUES ('card-1','version-1','book-1',1);
    INSERT INTO public.card_translations(card_id,language,title,body)
      VALUES ('card-1','en','Card','Body');`);
  await assert.rejects(db.query("UPDATE public.decks SET language='es' WHERE id='deck-1'"));
  await db.query("UPDATE public.deck_versions SET status='published' WHERE id='version-1'");
  await assert.rejects(db.query("UPDATE public.cards SET position=2 WHERE id='card-1'"));
  await assert.rejects(db.query("UPDATE public.deck_versions SET editorial_status='reviewed' WHERE id='version-1'"));
  await assert.rejects(db.query("DELETE FROM public.deck_versions WHERE id='version-1'"));

  // Check that postgres-created tables do not receive future Data API grants.
  await db.exec("CREATE TABLE public.future_probe(id integer GENERATED BY DEFAULT AS IDENTITY)");
  const afterCreate = await db.query(`SELECT
      has_table_privilege('anon','public.future_probe','SELECT') AS anon_select,
      has_table_privilege('authenticated','public.future_probe','SELECT') AS authenticated_select,
      has_sequence_privilege('anon','public.future_probe_id_seq','USAGE') AS anon_sequence_usage,
      has_sequence_privilege('authenticated','public.future_probe_id_seq','USAGE') AS authenticated_sequence_usage`);
  assert.deepEqual(afterCreate.rows,[{anon_select:false,authenticated_select:false,anon_sequence_usage:false,authenticated_sequence_usage:false}]);

  await db.exec("CREATE FUNCTION public.future_rpc() RETURNS integer LANGUAGE sql AS 'SELECT 1'");
  const futureFunction = await db.query(`SELECT
      has_function_privilege('public','public.future_rpc()','EXECUTE') AS public_exec,
      has_function_privilege('anon','public.future_rpc()','EXECUTE') AS anon_exec,
      has_function_privilege('authenticated','public.future_rpc()','EXECUTE') AS authenticated_exec,
      has_function_privilege('service_role','public.future_rpc()','EXECUTE') AS service_exec`);
  assert.deepEqual(futureFunction.rows,[{public_exec:false,anon_exec:false,authenticated_exec:false,service_exec:false}]);
});

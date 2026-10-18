import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";

const schema = await readFile(new URL("./schema.postgres.sql",import.meta.url),"utf8");
const migration = await readFile(new URL("../supabase/migrations/20261018021559_secure_public_tables.sql",import.meta.url),"utf8");

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

  const tableState = await db.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS without_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')`);
  assert.deepEqual(tableState.rows,[{total:31,without_rls:0}]);

  const directAccess = await db.query(`SELECT
      has_table_privilege('anon','public.accounts','SELECT') AS anon_select,
      has_table_privilege('authenticated','public.accounts','UPDATE') AS authenticated_update,
      has_table_privilege('anon','public.sessions','DELETE') AS anon_delete`);
  assert.deepEqual(directAccess.rows,[{anon_select:false,authenticated_update:false,anon_delete:false}]);

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
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.accounts TO anon,authenticated;`);

  for (const role of ["anon","authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    const visible = await db.query("SELECT count(*)::int AS count FROM public.accounts");
    assert.equal(visible.rows[0].count,0,`${role} must not read accounts even if a grant is reintroduced`);
    await assert.rejects(db.query(`INSERT INTO public.accounts(user_id,username,password_hash,time_zone,language)
      VALUES ('${role}-user','${role}user','hash','Europe/Madrid','es')`));
    await db.exec("RESET ROLE");
  }

  // DATABASE_URL and SQL Editor use a privileged database role, so app-owned
  // writes and operator maintenance remain available despite RLS.
  const privileged = await db.query("SELECT count(*)::int AS count FROM public.accounts");
  assert.equal(privileged.rows[0].count,1);
  await db.query("UPDATE public.accounts SET language='en' WHERE user_id='reader-1'");
  assert.equal((await db.query("SELECT language FROM public.accounts WHERE user_id='reader-1'")).rows[0].language,"en");

  // The app's privileged connection can still use each trigger in the CRUD
  // paths: authoring, card/version immutability, review progress and completion.
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
      VALUES ('card-1','en','Card','Body');
    INSERT INTO public.reviews(id,user_id,version_id) VALUES ('review-1','reader-1','version-1');`);
  await assert.rejects(db.query("UPDATE public.decks SET language='es' WHERE id='deck-1'"));
  await db.query(`INSERT INTO public.review_cards(review_id,user_id,version_id,card_id,local_day)
    VALUES ('review-1','reader-1','version-1','card-1','2026-10-18')`);
  assert.ok((await db.query("SELECT completed_at FROM public.reviews WHERE id='review-1'")).rows[0].completed_at);
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

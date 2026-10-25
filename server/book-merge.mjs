import {isPostgres,transaction} from "./database.mjs";
import {checkCatalog} from "./catalog-repository.mjs";
import {ApiError} from "./errors.mjs";

const readingRank={unread:0,reading:1,read:2};

function bookId(value) {
  if(typeof value!=="string"||!value.trim()||value.length>240) throw new ApiError(400,"invalidRequest");
  return value.trim();
}

export async function mergeBooks(db,{sourceBookId,targetBookId}) {
  const sourceId=bookId(sourceBookId),targetId=bookId(targetBookId);
  if(sourceId===targetId) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    if(isPostgres(db)) await db.exec("LOCK TABLE books,decks,cards,book_reading,deck_selections IN SHARE ROW EXCLUSIVE MODE;");
    const source=await db.prepare("SELECT id,creator_user_id,author,popular_title,popular_language FROM books WHERE id=?").get(sourceId);
    const target=await db.prepare("SELECT id,author,popular_title,popular_language FROM books WHERE id=?").get(targetId);
    if(!source||!target) throw new ApiError(404,"bookUnavailable");

    // Keep target values where present and fill only its missing core metadata.
    await db.prepare(`UPDATE books SET
      author=CASE WHEN length(trim(author))=0 THEN ? ELSE author END,
      popular_title=CASE WHEN length(trim(popular_title))=0 THEN ? ELSE popular_title END,
      popular_language=CASE WHEN length(trim(popular_language))=0 THEN ? ELSE popular_language END
      WHERE id=?`).run(source.author,source.popular_title,source.popular_language,targetId);
    const targetPopularTranslation=await db.prepare("SELECT title FROM book_translations WHERE book_id=? AND language=?").get(targetId,source.popular_language);
    const targetLacksPopularTranslation=!targetPopularTranslation?.title?.trim();

    // Fill missing translation fields, genres and links from the source.
    await db.prepare(`INSERT INTO book_translations(book_id,language,title,description,editorial_note)
      SELECT ?,language,title,description,editorial_note FROM book_translations WHERE book_id=?
      ON CONFLICT(book_id,language) DO UPDATE SET
        title=CASE WHEN length(trim(book_translations.title))=0 THEN excluded.title ELSE book_translations.title END,
        description=CASE WHEN length(trim(book_translations.description))=0 THEN excluded.description ELSE book_translations.description END,
        editorial_note=CASE WHEN length(trim(book_translations.editorial_note))=0 THEN excluded.editorial_note ELSE book_translations.editorial_note END`).run(targetId,sourceId);
    // A source's popular title is not necessarily represented in book_translations.
    // Preserve it when the destination had no title in that language. A translation
    // row requires description/editorial metadata, so this applies when a valid target
    // row exists or when copying the source creates one.
    if(targetLacksPopularTranslation){
      await db.prepare("UPDATE book_translations SET title=? WHERE book_id=? AND language=?")
        .run(source.popular_title,targetId,source.popular_language);
    }
    await db.prepare(`INSERT INTO book_links(book_id,platform,url)
      SELECT ?,platform,url FROM book_links WHERE book_id=? ON CONFLICT(book_id,platform) DO UPDATE SET
        url=CASE WHEN length(trim(book_links.url))=0 THEN excluded.url ELSE book_links.url END`).run(targetId,sourceId);
    await db.prepare(`INSERT INTO book_genres(book_id,genre_id)
      SELECT ?,genre_id FROM book_genres WHERE book_id=? ON CONFLICT(book_id,genre_id) DO NOTHING`).run(targetId,sourceId);

    const sourceReading=await db.prepare("SELECT user_id,status FROM book_reading WHERE book_id=?").all(sourceId);
    // Account-created books appear on their creator's profile even if their explicit
    // reading row was cleared. Preserve that profile entry when removing the source.
    if(source.creator_user_id&&!sourceReading.some(row=>row.user_id===source.creator_user_id)) sourceReading.push({user_id:source.creator_user_id,status:"unread"});
    let mergedReaders=0;
    for(const row of sourceReading){
      const existing=await db.prepare("SELECT status FROM book_reading WHERE user_id=? AND book_id=?").get(row.user_id,targetId);
      const status=!existing||readingRank[row.status]>readingRank[existing.status]?row.status:existing.status;
      await db.prepare(`INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,?)
        ON CONFLICT(user_id,book_id) DO UPDATE SET status=excluded.status`).run(row.user_id,targetId,status);
      mergedReaders++;
    }

    // This legacy table permits one reference per user and book. Keep a target row
    // when both exist; otherwise carry the source row so its deck/book foreign key survives.
    const sourceSelections=await db.prepare("SELECT user_id,deck_id FROM deck_selections WHERE book_id=?").all(sourceId);
    await db.prepare("DELETE FROM deck_selections WHERE book_id=?").run(sourceId);

    const targetHasRecommendation=!!await db.prepare("SELECT 1 FROM decks WHERE book_id=? AND is_recommended=1").get(targetId);
    const sourceDecks=await db.prepare("SELECT id FROM decks WHERE book_id=? ORDER BY id").all(sourceId);
    const movedCards=Number((await db.prepare("SELECT count(*) AS n FROM cards WHERE book_id=?").get(sourceId)).n);
    if(isPostgres(db)) await db.prepare("INSERT INTO book_merge_operations(source_book_id,target_book_id) VALUES (?,?)").run(sourceId,targetId);
    else await db.prepare("INSERT INTO book_merge_operations(source_book_id,target_book_id) VALUES (?,?)").run(sourceId,targetId);
    if(targetHasRecommendation) await db.prepare("UPDATE decks SET is_recommended=0 WHERE book_id=? AND is_recommended=1").run(sourceId);
    await db.prepare("UPDATE decks SET book_id=? WHERE book_id=?").run(targetId,sourceId);
    await db.prepare("DELETE FROM book_merge_operations WHERE source_book_id=? AND target_book_id=?").run(sourceId,targetId);

    for(const selection of sourceSelections){
      await db.prepare(`INSERT INTO deck_selections(user_id,book_id,deck_id) VALUES (?,?,?)
        ON CONFLICT(user_id,book_id) DO NOTHING`).run(selection.user_id,targetId,selection.deck_id);
    }
    await db.prepare("DELETE FROM book_reading WHERE book_id=?").run(sourceId);
    await db.prepare("DELETE FROM books WHERE id=?").run(sourceId);

    // Keep catalog positions unique and consecutive after removing the duplicate.
    const remaining=await db.prepare("SELECT id,position FROM books ORDER BY position,id").all();
    const maxPosition=Math.max(0,...remaining.map(row=>Number(row.position)));
    const temporaryBase=maxPosition+remaining.length+1;
    for(const [index,row] of remaining.entries()) await db.prepare("UPDATE books SET position=? WHERE id=?").run(temporaryBase+index,row.id);
    for(const [index,row] of remaining.entries()) await db.prepare("UPDATE books SET position=? WHERE id=?").run(index+1,row.id);

    const dangling=await db.prepare(`SELECT
      (SELECT count(*) FROM decks WHERE book_id=?) +
      (SELECT count(*) FROM cards WHERE book_id=?) +
      (SELECT count(*) FROM book_reading WHERE book_id=?) +
      (SELECT count(*) FROM deck_selections WHERE book_id=?) +
      (SELECT count(*) FROM book_links WHERE book_id=?) +
      (SELECT count(*) FROM book_genres WHERE book_id=?) +
      (SELECT count(*) FROM book_translations WHERE book_id=?) AS n`).get(sourceId,sourceId,sourceId,sourceId,sourceId,sourceId,sourceId);
    if(Number(dangling.n)!==0||await db.prepare("SELECT 1 FROM books WHERE id=?").get(sourceId)) throw new Error("Book merge left source references");
    await checkCatalog(db);
    return {sourceBookId:sourceId,targetBookId:targetId,movedDecks:sourceDecks.length,movedCards,mergedReaders,retainedDeckMemberships:true};
  });
}

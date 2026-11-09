import {isDeepStrictEqual} from "node:util";
import {LANGUAGES,BOOK_AUTHOR_MAX_LENGTH,TITLE_MAX_LENGTH,isCanonicalLocale} from "../app/core.mjs";
import {normalizeBookMetadata} from "../app/book-metadata.mjs";
import {findBookTitleMatches} from "../app/book-duplicates.mjs";
import {bookInterestError} from "../app/book-interests.mjs";
import {validateBookLinks} from "../app/book-links.mjs";
import {catalogBookIncorporationTimestamp} from "../app/catalog-incorporation.mjs";
import {transaction,isPostgres} from "./database.mjs";
import {checkCatalog,readCatalog} from "./catalog-repository.mjs";
import {ApiError} from "./errors.mjs";

function bookId(value) {
  if(typeof value!=="string"||value.length>240||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new ApiError(400,"invalidRequest");
  return value;
}

function requiredText(value,max) {
  if(typeof value!=="string"||!value.trim()||value.trim().length>max) throw new ApiError(400,"invalidRequest");
  return value.trim();
}

async function validateBookInterests(db,ids,options={}) {
  const knownIds=new Set((await db.prepare("SELECT id FROM genres").all()).map(row=>row.id));
  const error=bookInterestError(ids,knownIds,options);
  if(error) throw new ApiError(400,error);
}

function catalogMetadata(input,{partial=false}={}) {
  let metadata;
  try { metadata=normalizeBookMetadata(input,{completeTranslations:!partial,canonicalTitles:true}); }
  catch { throw new ApiError(400,"invalidRequest"); }
  if(metadata.popularTitle) requiredText(metadata.popularTitle,TITLE_MAX_LENGTH);
  if(metadata.popularLanguage&&!isCanonicalLocale(metadata.popularLanguage)) throw new ApiError(400,"invalidRequest");
  try { validateBookLinks(metadata.links,{required:true}); }
  catch { throw new ApiError(400,"invalidRequest"); }
  return metadata;
}

function titlesForDuplicateCheck(book) {
  return [book.popularTitle,...Object.values(book.title||{})].filter(Boolean);
}

function rejectTitleDuplicates(book,books) {
  if(findBookTitleMatches(titlesForDuplicateCheck(book),books).some(match=>match.blocked)) {
    throw new ApiError(409,"bookAlreadyExists");
  }
}

export async function createCatalogBook(db,input) {
  const id=bookId(input.bookId),author=requiredText(input.author,BOOK_AUTHOR_MAX_LENGTH),metadata=catalogMetadata(input.metadata);
  if(!metadata.popularTitle||!metadata.popularLanguage) throw new ApiError(400,"invalidRequest");
  for(const language of LANGUAGES) if(!metadata.description[language]||!metadata.editorialNote[language]) throw new ApiError(400,"invalidRequest");

  return transaction(db,async()=>{
    if(isPostgres(db)) await db.exec("LOCK TABLE books IN SHARE ROW EXCLUSIVE MODE;");
    await validateBookInterests(db,metadata.genres);
    const existing=await readCatalog(db),sameId=existing.books.find(book=>book.id===id);
    if(sameId) {
      const saved=normalizeBookMetadata(sameId,{canonicalTitles:true});
      if(sameId.creatorUserId===null&&sameId.author===author&&isDeepStrictEqual(saved,metadata)) return {bookId:id,idempotent:true};
      throw new ApiError(409,"bookAlreadyExists");
    }
    rejectTitleDuplicates({popularTitle:metadata.popularTitle,title:metadata.title},existing.books);
    const {position}=await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM books").get();
    const {incorporation_order:incorporationOrder}=await db.prepare("SELECT COALESCE(MAX(incorporation_order),0)+1 AS incorporation_order FROM books").get();
    await db.prepare(`INSERT INTO books(id,author,popular_title,popular_language,position,editorial_status,updated_at,incorporated_at,incorporation_order)
      VALUES (?,?,?,?,?,'draft',CURRENT_TIMESTAMP,?,?)`)
      .run(id,author,metadata.popularTitle,metadata.popularLanguage,position,catalogBookIncorporationTimestamp(),incorporationOrder);
    for(const language of Object.keys(metadata.description)) await db.prepare(`INSERT INTO book_translations(book_id,language,title,description,editorial_note)
      VALUES (?,?,?,?,?)`).run(id,language,metadata.title[language]||"",metadata.description[language],metadata.editorialNote[language]);
    for(const [index,genre] of metadata.genres.entries()) await db.prepare("INSERT INTO book_genres(book_id,genre_id,position) VALUES (?,?,?)").run(id,genre,index+1);
    for(const [platform,url] of Object.entries(metadata.links)) await db.prepare("INSERT INTO book_links(book_id,platform,url) VALUES (?,?,?)").run(id,platform,url);
    await checkCatalog(db);
    return {bookId:id};
  });
}

async function readBookForEdit(db,id,{lock=false}={}) {
  const row=await db.prepare(`SELECT id,author,popular_title,popular_language,creator_user_id FROM books WHERE id=?${lock&&isPostgres(db)?" FOR UPDATE":""}`).get(id);
  if(!row) throw new ApiError(404,"bookUnavailable");
  const metadata={popularTitle:row.popular_title,popularLanguage:row.popular_language,title:{},description:{},editorialNote:{},
    genres:(await db.prepare("SELECT genre_id FROM book_genres WHERE book_id=? ORDER BY position").all(id)).map(item=>item.genre_id),
    links:Object.fromEntries((await db.prepare("SELECT platform,url FROM book_links WHERE book_id=? ORDER BY platform").all(id)).map(item=>[item.platform,item.url]))};
  for(const item of await db.prepare("SELECT language,title,description,editorial_note FROM book_translations WHERE book_id=?").all(id)) {
    metadata.title[item.language]=item.title;metadata.description[item.language]=item.description;metadata.editorialNote[item.language]=item.editorial_note;
  }
  return {id,author:row.author,creatorUserId:row.creator_user_id,metadata};
}

export async function editCatalogBook(db,input) {
  const id=bookId(input.bookId),hasAuthor=input.author!==undefined,hasMetadata=input.metadata&&Object.keys(input.metadata).length>0;
  if(!hasAuthor&&!hasMetadata) throw new ApiError(400,"invalidRequest");
  const author=hasAuthor?requiredText(input.author,BOOK_AUTHOR_MAX_LENGTH):null;
  let proposal;
  if(hasMetadata) {
    try { proposal=normalizeBookMetadata(input.metadata,{completeTranslations:false,canonicalTitles:true}); }
    catch { throw new ApiError(400,"invalidRequest"); }
    if(proposal.genres.length) {
      const error=bookInterestError(proposal.genres);
      if(error) throw new ApiError(400,error);
    }
    if(Object.keys(proposal.links).length) {
      try { validateBookLinks(proposal.links,{required:true}); }
      catch { throw new ApiError(400,"invalidRequest"); }
    }
  }

  return transaction(db,async()=>{
    if(isPostgres(db)) await db.exec("LOCK TABLE books IN SHARE ROW EXCLUSIVE MODE;");
    const current=await readBookForEdit(db,id,{lock:true});
    const next={...current,author:author??current.author,metadata:structuredClone(current.metadata)};
    if(proposal) {
      for(const field of ["popularTitle","popularLanguage"]) if(proposal[field]!==undefined) next.metadata[field]=proposal[field];
      for(const field of ["title","description","editorialNote"]) next.metadata[field]={...next.metadata[field],...proposal[field]};
      if(Object.hasOwn(input.metadata,"genres")) next.metadata.genres=proposal.genres;
      if(Object.hasOwn(input.metadata,"links")) next.metadata.links=proposal.links;
    }
    try { next.metadata=normalizeBookMetadata(next.metadata,{canonicalTitles:true}); }
    catch { throw new ApiError(400,"invalidRequest"); }
    if(!next.metadata.popularTitle||!next.metadata.popularLanguage) throw new ApiError(400,"invalidRequest");
    if(current.creatorUserId===null) for(const language of LANGUAGES) if(!next.metadata.description[language]||!next.metadata.editorialNote[language]) throw new ApiError(400,"invalidRequest");
    if(current.creatorUserId===null||Object.hasOwn(input.metadata||{},"genres")) await validateBookInterests(db,next.metadata.genres,{existingIds:current.metadata.genres});
    try { validateBookLinks(next.metadata.links,{required:current.creatorUserId===null}); }
    catch { throw new ApiError(400,"invalidRequest"); }

    if(Object.hasOwn(input.metadata||{},"popularTitle")||Object.hasOwn(input.metadata||{},"title")) {
      const others=(await readCatalog(db)).books.filter(book=>book.id!==id);
      rejectTitleDuplicates({popularTitle:next.metadata.popularTitle,title:next.metadata.title},others);
    }
    await db.prepare("UPDATE books SET author=?,popular_title=?,popular_language=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(next.author,next.metadata.popularTitle,next.metadata.popularLanguage,id);
    const translationFields={title:"title",description:"description",editorialNote:"editorial_note"};
    const translationLanguages=new Set(Object.keys(translationFields).flatMap(field=>Object.keys(proposal?.[field]||{})));
    for(const language of translationLanguages) {
      if(!Object.hasOwn(current.metadata.description,language)) {
        await db.prepare(`INSERT INTO book_translations(book_id,language,title,description,editorial_note)
          VALUES (?,?,?,?,?)`).run(id,language,next.metadata.title[language]||"",next.metadata.description[language],next.metadata.editorialNote[language]);
        continue;
      }
      for(const [field,column] of Object.entries(translationFields)) if(Object.hasOwn(proposal[field],language)) {
        await db.prepare(`UPDATE book_translations SET ${column}=? WHERE book_id=? AND language=?`).run(next.metadata[field][language],id,language);
      }
    }
    if(Object.hasOwn(input.metadata||{},"genres")) {
      await db.prepare("DELETE FROM book_genres WHERE book_id=?").run(id);
      for(const [index,genre] of next.metadata.genres.entries()) await db.prepare("INSERT INTO book_genres(book_id,genre_id,position) VALUES (?,?,?)").run(id,genre,index+1);
    }
    if(Object.hasOwn(input.metadata||{},"links")) {
      await db.prepare("DELETE FROM book_links WHERE book_id=?").run(id);
      for(const [platform,url] of Object.entries(next.metadata.links)) await db.prepare("INSERT INTO book_links(book_id,platform,url) VALUES (?,?,?)").run(id,platform,url);
    }
    await checkCatalog(db);
    return {bookId:id};
  });
}

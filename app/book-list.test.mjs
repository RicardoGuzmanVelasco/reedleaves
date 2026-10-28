import test from 'node:test';
import assert from 'node:assert/strict';
import {BOOK_SHELF_THRESHOLD,defaultBookView,bookListMarkup,bookViewSelector,leaningBookIndex} from './book-list.mjs';
import {libraryResultsMarkup,bookshelfView} from './views.mjs';
import {readerState} from '../test-support/reader-state.mjs';
import {openDatabase,initializeDatabase} from '../server/database.mjs';
import {seedCatalog} from '../server/seed.mjs';
import {readCatalog} from '../server/catalog-repository.mjs';
import {prepareCatalog} from './catalog.mjs';

test('Book lists default at ten and respect explicit choices across count changes',()=>{
  assert.equal(BOOK_SHELF_THRESHOLD,10);
  assert.equal(defaultBookView(BOOK_SHELF_THRESHOLD-1),'covers');assert.equal(defaultBookView(BOOK_SHELF_THRESHOLD),'shelf');
  for(const view of ['covers','shelf','stack'])assert.equal(defaultBookView(25,view),view);
  assert.equal(defaultBookView(2,'stack'),'stack');assert.equal(defaultBookView(15,'unknown'),'shelf');
});
test('Spines retain safe destinations, titles, languages and authors in both orientations',()=>{
  const books=[{id:'one',href:'#book/one',title:'A <long> title',author:'An & author',language:'en'}];
  for(const view of ['shelf','stack']){
    const html=bookListMarkup({books,view,label:'Books'});
    assert.match(html,/href="#book\/one"/);assert.match(html,/lang="en"/);
    assert.match(html,/A &lt;long&gt; title, An &amp; author/);assert.doesNotMatch(html,/<long>/);
  }
  const selector=bookViewSelector('stack','library','en');
  assert.match(selector,/aria-label="Stacked books"[^>]*aria-pressed|aria-pressed="true" aria-label="Stacked books"/);
  assert.equal((selector.match(/aria-pressed="true"/g)||[]).length,1);
  const stack=bookListMarkup({books:[books[0],{...books[0],id:'two',href:'#book/two',title:'Second'}],view:'stack',label:'Books'});
  assert.ok(stack.indexOf('href="#book/one"')<stack.indexOf('href="#book/two"'));
  for(const view of ['covers','shelf','stack']){
    const html=bookListMarkup({books:[books[0],{...books[0],id:'two',href:'#book/two',title:'Second'}],view,label:'Books',cover:entry=>`<a href="${entry.href}">${entry.title}</a>`});
    assert.ok(html.indexOf('href="#book/one"')<html.indexOf('href="#book/two"'),`${view} preserves the chosen order`);
  }
});
test('Library choice remains independent of personal shelf groups',async()=>{
  const db=openDatabase(':memory:');
  try{
    await initializeDatabase(db);await seedCatalog(db);
    const catalog=prepareCatalog(await readCatalog(db));
    const state=readerState(catalog,{libraryQuery:'',libraryFilters:{},bookViews:{library:'stack',bookshelf:'shelf'},userId:'reader',statuses:Object.fromEntries(catalog.books.map(book=>[book.id,'reading']))});
    assert.match(libraryResultsMarkup(state),/data-book-spines="stack"/);
    const shelf=bookshelfView(state);assert.doesNotMatch(shelf,/data-action="set-book-view"/);
    assert.doesNotMatch(shelf,/data-book-spines=/);
    for(const book of catalog.books)assert.ok(shelf.includes(`data-book="${book.id}"`));
    assert.match(libraryResultsMarkup({...state,bookViews:{library:'covers'}}),/study-books book-grid/);
    const az=libraryResultsMarkup({...state,bookSortOrder:'alphabetical',language:'en'});
    assert.match(az,/aria-label="Sort by"/);assert.match(az,/Most recent/);assert.match(az,/A–Z/);
    assert.doesNotMatch(az,/My interests|Mis intereses/);
  }finally{await db.close();}
});

test('Personal shelf fixes Reading to covers; To read and Read have selectors',async()=>{
  const db=openDatabase(':memory:');
  try{
    await initializeDatabase(db);await seedCatalog(db);
    const source=prepareCatalog(await readCatalog(db));
    const books=Array.from({length:14},(_,index)=>({...source.books[0],id:`group-book-${index}`}));
    const catalog={...source,books,booksById:new Map(books.map(book=>[book.id,book]))};
    const statuses=Object.fromEntries(books.map((book,index)=>[book.id,index===0?'reading':index>=12?'unread':'read']));
    const base=readerState(catalog,{userId:'reader',statuses,shelfBookIds:books.filter((_,index)=>index!==12).map(book=>book.id),cardSaves:[{bookId:books[12].id}],bookViews:{bookshelf:'stack'}});
    const group=(html,key)=>html.match(new RegExp(`<section class="bookshelf-group" aria-labelledby="bookshelf-group-${key}">([\\s\\S]*?)<\\/section>`))?.[1];
    const html=bookshelfView(base);
    assert.match(group(html,'reading'),/study-books book-grid/);
    assert.doesNotMatch(group(html,'reading'),/data-action="set-book-view"/);
    assert.equal(group(html,'unread'),undefined);
    assert.match(group(html,'to-read'),/data-book-spines="stack"/);
    assert.match(group(html,'to-read'),/data-scope="bookshelf-to-read"/);
    assert.match(group(html,'read'),/data-scope="bookshelf-read"/);
    assert.match(group(html,'read'),/data-book-spines="shelf"/);
    assert.equal((html.match(/data-action="set-book-view"/g)||[]).length,6);
    assert.match(group(bookshelfView({...base,bookViews:{'bookshelf-read':'stack'}}),'read'),/data-book-spines="stack"/);
    assert.match(group(bookshelfView({...base,bookViews:{'bookshelf-to-read':'covers'}}),'to-read'),/study-books book-grid/);
    const ten={...base,statuses:{...statuses,[books[11].id]:'unread'}};
    assert.match(group(bookshelfView(ten),'read'),/data-book-spines="shelf"/);
    const nine={...base,statuses:{...ten.statuses,[books[10].id]:'unread'}};
    assert.match(group(bookshelfView(nine),'read'),/study-books book-grid/);
    const publicShelf=bookshelfView({...base,readOnly:true,profileData:{profile:{id:'another',name:'Reader'},bookshelf:[{bookId:books[13].id,reading:'unread',group:'to-read'}]}});
    assert.match(group(publicShelf,'to-read'),/data-book-spines="stack"/);
    assert.match(group(publicShelf,'to-read'),/data-scope="public-bookshelf-to-read"/);
  }finally{await db.close();}
});

test('Only the last book of an incomplete shelf with a neighbour leans',()=>{
  assert.equal(leaningBookIndex(0,8),-1);assert.equal(leaningBookIndex(1,8),-1);
  assert.equal(leaningBookIndex(8,8),-1);assert.equal(leaningBookIndex(9,8),-1);
  assert.equal(leaningBookIndex(10,8),9);assert.equal(leaningBookIndex(77,9),76);
  assert.equal(leaningBookIndex(77,1),-1);
});

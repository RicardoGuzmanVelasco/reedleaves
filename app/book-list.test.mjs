import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBookView,bookListMarkup,bookViewSelector,leaningBookIndex} from './book-list.mjs';
import {libraryResultsMarkup,bookshelfView} from './views.mjs';
import {readerState} from '../test-support/reader-state.mjs';
import {openDatabase,initializeDatabase} from '../server/database.mjs';
import {seedCatalog} from '../server/seed.mjs';
import {readCatalog} from '../server/catalog-repository.mjs';
import {prepareCatalog} from './catalog.mjs';

test('Book lists default at ten and respect explicit choices across count changes',()=>{
  assert.equal(defaultBookView(9),'covers');assert.equal(defaultBookView(10),'shelf');
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
});
test('Library and grouped personal shelves share view choice and preserve book access',async()=>{
  const db=openDatabase(':memory:');
  try{
    await initializeDatabase(db);await seedCatalog(db);
    const catalog=prepareCatalog(await readCatalog(db));
    const state=readerState(catalog,{libraryQuery:'',libraryFilters:{},bookViews:{library:'stack',bookshelf:'shelf'},userId:'reader',statuses:Object.fromEntries(catalog.books.map(book=>[book.id,'reading']))});
    assert.match(libraryResultsMarkup(state),/data-book-spines="stack"/);
    const shelf=bookshelfView(state);assert.match(shelf,/data-book-spines="shelf"/);
    for(const book of catalog.books)assert.ok(shelf.includes(`data-book="${book.id}"`));
    assert.match(libraryResultsMarkup({...state,bookViews:{library:'covers'}}),/study-books book-grid/);
  }finally{await db.close();}
});

test('Only the last book of an incomplete shelf with a neighbour leans',()=>{
  assert.equal(leaningBookIndex(0,8),-1);assert.equal(leaningBookIndex(1,8),-1);
  assert.equal(leaningBookIndex(8,8),-1);assert.equal(leaningBookIndex(9,8),-1);
  assert.equal(leaningBookIndex(10,8),9);assert.equal(leaningBookIndex(77,9),76);
  assert.equal(leaningBookIndex(77,1),-1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {BOOK_SHELF_THRESHOLD,defaultBookView,bookListMarkup,bookViewSelector,leaningBookIndex,partitionLibraryBooks} from './book-list.mjs';
import {libraryResultsMarkup,bookshelfView,accountView} from './views.mjs';
import {readerState} from '../test-support/reader-state.mjs';
import {openDatabase,initializeDatabase} from '../server/database.mjs';
import {seedCatalog} from '../server/seed.mjs';
import {readCatalog} from '../server/catalog-repository.mjs';
import {prepareCatalog} from './catalog.mjs';
import {filterLibrary} from './book-search.mjs';

test('Book lists default at ten and respect explicit choices across count changes',()=>{
  assert.equal(BOOK_SHELF_THRESHOLD,10);
  assert.equal(defaultBookView(BOOK_SHELF_THRESHOLD-1),'covers');assert.equal(defaultBookView(BOOK_SHELF_THRESHOLD),'shelf');
  for(const view of ['covers','shelf','stack'])assert.equal(defaultBookView(25,view),view);
  assert.equal(defaultBookView(2,'stack'),'stack');assert.equal(defaultBookView(15,'unknown'),'shelf');
});
test('new book partitions preserve the chosen order',()=>{
  const groups=partitionLibraryBooks([{id:'new-b'},{id:'old-a'},{id:'new-a'},{id:'old-b'}],['new-a','new-b','unknown']);
  assert.deepEqual(groups.newBooks.map(book=>book.id),['new-b','new-a']);
  assert.deepEqual(groups.otherBooks.map(book=>book.id),['old-a','old-b']);
});
test('Library novelty groups work in every view, locale and order without mutating the visit snapshot',async()=>{
  const db=openDatabase(':memory:');
  try{
    await initializeDatabase(db);await seedCatalog(db);
    const source=prepareCatalog(await readCatalog(db));
    const books=source.books.slice(0,4).map((book,index)=>({...book,author:index<2?'New author':'Other author'}));
    const catalog={...source,books,booksById:new Map(books.map(book=>[book.id,book]))};
    const snapshot=Object.freeze(books.slice(0,2).map(book=>book.id));
    for(const language of ['es','en'])for(const view of ['covers','shelf','stack'])for(const order of ['recent','alphabetical','interests']){
      const state=readerState(catalog,{language,libraryQuery:'',libraryFilters:{},libraryNewBookIds:snapshot,bookViews:{library:view},bookSortOrder:order,interestPreferences:{interested:['books'],notInterested:['society']}});
      const html=libraryResultsMarkup(state);
      const expected=partitionLibraryBooks(filterLibrary(catalog,'',{},order,language,state.interestPreferences),snapshot);
      const ids=[...expected.newBooks,...expected.otherBooks].map(book=>book.id);
      const positions=ids.map(id=>html.indexOf('data-book="'+id+'"'));
      assert.ok(positions.every(position=>position>=0));
      assert.deepEqual(positions,[...positions].sort((a,b)=>a-b),view+' / '+language+' / '+order);
      for(const id of ids)assert.equal((html.match(new RegExp('data-book="'+id+'"','g'))||[]).length,1);
      assert.ok(html.indexOf('id="library-book-group-new"')<html.indexOf('id="library-book-group-other"'));
      assert.match(html,new RegExp('aria-label="'+(language==='es'?'Novedades':'New books')+'"'));
      assert.match(html,new RegExp('aria-hidden="true">'+(language==='es'?'Nuevo':'New')+'<'));
      assert.equal((html.match(/data-action="set-book-view"/g)||[]).length,3);
      assert.match(html,new RegExp('data-view="'+view+'"[^>]*aria-pressed="true"'));
      const filtered=libraryResultsMarkup({...state,libraryFilters:{author:'Other author'}});
      assert.doesNotMatch(filtered,/id="library-book-group-new"/);
      assert.match(filtered,/id="library-book-group-other"/);
      const onlyNew=libraryResultsMarkup({...state,libraryFilters:{author:'New author'}});
      assert.match(onlyNew,/id="library-book-group-new"/);
      assert.doesNotMatch(onlyNew,/id="library-book-group-other"/);
      const empty=libraryResultsMarkup({...state,libraryQuery:'no matching book'});
      assert.doesNotMatch(empty,/library-book-group/);
      assert.match(empty,/data-action="clear-book-search"/);
      assert.equal(libraryResultsMarkup(state),html,'clearing a filter restores the same visit');
      assert.equal(state.libraryNewBookIds,snapshot);
      assert.deepEqual(snapshot,books.slice(0,2).map(book=>book.id));
      assert.doesNotMatch(libraryResultsMarkup({...state,libraryNewBookIds:[]}),/library-book-group|study-book-new-badge/);
    }
    const tenBooks=Array.from({length:10},(_,index)=>({...books[index%books.length],id:'default-view-'+index}));
    const denseCatalog={...catalog,books:tenBooks,booksById:new Map(tenBooks.map(book=>[book.id,book]))};
    const dense=libraryResultsMarkup(readerState(denseCatalog,{libraryNewBookIds:[tenBooks[0].id],libraryQuery:'',libraryFilters:{}}));
    assert.equal((dense.match(/data-book-spines="shelf"/g)||[]).length,2,'both groups use the view selected from the whole result count');
  }finally{await db.close();}
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
    assert.match(az,/<option value="alphabetical" selected>A–Z<\/option>/);
    assert.match(az,/<option value="interests" >My interests<\/option>/);
  }finally{await db.close();}
});

test('Library interest sort follows reader preferences across all three presentations and never reaches Bookcase',async()=>{
  const db=openDatabase(':memory:');
  try{
    await initializeDatabase(db);await seedCatalog(db);
    const source=prepareCatalog(await readCatalog(db));
    const books=[
      {...source.books[0],id:'neutral-book',genres:['unlisted']},
      {...source.books[1],id:'secondary-book',genres:['unlisted','books']},
      {...source.books[2],id:'primary-book',genres:['books']},
      {...source.books[3],id:'rejected-book',genres:['society']}
    ];
    const catalog={...source,books,booksById:new Map(books.map(book=>[book.id,book]))};
    const state=readerState(catalog,{libraryQuery:'',libraryFilters:{},bookSortOrder:'interests',interestPreferences:{interested:['books'],notInterested:['society']},userId:'reader'});
    for(const view of ['covers','shelf','stack']){
      const html=libraryResultsMarkup({...state,bookViews:{library:view}});
      assert.match(html,/<option value="interests" selected>Mis intereses<\/option>/);
      assert.match(html,new RegExp(`data-view="${view}"[^>]*aria-pressed="true"`));
      const ids=view==='covers'?['primary-book','secondary-book','neutral-book','rejected-book']:['primary-book','secondary-book','neutral-book','rejected-book'];
      const positions=ids.map(id=>html.indexOf(view==='covers'?`data-book="${id}"`:`href="#book/${id}"`));
      assert.ok(positions.every(position=>position>=0));
      assert.deepEqual(positions,[...positions].sort((a,b)=>a-b),`${view} follows the selected interest order`);
    }
    const bookcase=bookshelfView(state);
    assert.doesNotMatch(bookcase,/data-book-sort|value="interests"|Mis intereses/);
  }finally{await db.close();}
});

test('visitor interest sort recovery opens the localized sign-in form with a functional return path',()=>{
  for(const [language,label] of [['es','Inicia sesión para ordenar por tus intereses.'],['en','Sign in to sort by your interests.']]){
    const html=accountView({language,authMode:'login',accountInterestSortNotice:true});
    assert.ok(html.includes(label));
    assert.match(html,/data-account-form/);
    assert.match(html,/data-action="toggle-auth"/);
  }
});

test('interest sort loading/failure never marks the order active and exposes a retry',async()=>{
  const db=openDatabase(':memory:');
  try{
    await initializeDatabase(db);await seedCatalog(db);
    const catalog=prepareCatalog(await readCatalog(db)),base=readerState(catalog,{libraryQuery:'',libraryFilters:{},userId:'reader'});
    const pending=libraryResultsMarkup({...base,bookSortOrder:'interests',librarySortOrder:'recent',libraryInterestSortPending:true});
    assert.match(pending,/<option value="recent" selected>Más recientes<\/option>/);
    assert.match(pending,/role="status">Cargando tus intereses…<\/span>/);
    assert.doesNotMatch(pending,/<option value="interests" selected>/);
    const failed=libraryResultsMarkup({...base,bookSortOrder:'interests',librarySortOrder:'recent',libraryInterestSortError:true});
    assert.match(failed,/<option value="recent" selected>Más recientes<\/option>/);
    assert.match(failed,/role="alert"><span>No se pudieron cargar tus intereses\.<\/span><button[^>]*data-action="retry-library-interest-sort">Reintentar<\/button>/);
    assert.doesNotMatch(failed,/<option value="interests" selected>/);
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

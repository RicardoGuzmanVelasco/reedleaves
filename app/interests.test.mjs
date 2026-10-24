import test from "node:test";
import assert from "node:assert/strict";
import {interestIcon} from "./interests.mjs";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {libraryView,authorFormView} from "./views.mjs";
import {readerState} from "../test-support/reader-state.mjs";

test("Interests keep localized names beside decorative icons in details, filters and editing",async()=>{
  const db=openDatabase(":memory:");let catalog;
  try{initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db));}finally{await db.close();}
  for(const language of ["es","en"]) {
    for(const id of ["software","mindfulness"]) {
      assert.ok(catalog.genres.find(genre=>genre.id===id).name[language]);
      const book={...catalog.booksById.get("seven-habits"),genres:[id]};
      const state=readerState({...catalog,booksById:new Map(catalog.booksById).set(book.id,book)},{language,openBookId:book.id,libraryFilters:{genre:id}});
      const html=libraryView(state);
      assert.match(html,new RegExp(`value="${id}" selected`));
      assert.ok(html.includes(interestIcon(id)));
      assert.ok(html.includes(catalog.genres.find(genre=>genre.id===id).name[language]));
      const form=authorFormView({...state,userId:"reader",authorForm:{kind:"book",requestId:"book-test",title:"Book",author:"Author",language:"en",metadata:{title:{es:"Libro",en:"Book"},description:{es:"Texto",en:"Text"},editorialNote:{es:"Nota",en:"Note"},genres:[],links:{}}}});
      assert.ok(form.includes(interestIcon(id)));
    }
  }
  assert.equal(interestIcon('<script>'),interestIcon('unknown'));
  assert.match(interestIcon('software'),/aria-hidden="true"/);
});

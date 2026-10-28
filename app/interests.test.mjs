import test from "node:test";
import assert from "node:assert/strict";
import {interestIcon,interestColor,validInterestAppearance} from "./interests.mjs";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {libraryView,authorFormView} from "./views.mjs";
import {readerState} from "../test-support/reader-state.mjs";

const approved={"personal-growth":"🌱",finance:"💰",productivity:"🎯",society:"🌍",software:"💻",mindfulness:"🧘",metaphysics:"🔮"};
test("All approved interests use catalog emojis and localized names in details, preview and real checkboxes; native filters stay text",async()=>{
  const db=openDatabase(":memory:");let catalog;
  try{initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db));}finally{await db.close();}
  for(const language of ["es","en"]) for(const [id,emoji] of Object.entries(approved)) {
    const interest=catalog.genres.find(genre=>genre.id===id);
    assert.equal(interest.emoji,emoji);assert.ok(validInterestAppearance(interest));
    const name=interest.name[language];assert.ok(name);
    const book={...catalog.booksById.get("seven-habits"),genres:[id]};
    const state=readerState({...catalog,booksById:new Map(catalog.booksById).set(book.id,book)},{language,libraryFiltersOpen:true,openBookId:book.id,libraryFilters:{genre:id}});
    const html=libraryView(state);
    assert.match(html,new RegExp(`<option value="${id}" selected>${name}</option>`));
    assert.ok(html.includes(`${interestIcon(interest)}${name}`));
    assert.ok(html.includes(interestColor(interest)));
    assert.match(interestIcon(interest),/aria-hidden="true"/);
    const formState={...state,userId:"reader",authorForm:{kind:"book",requestId:"book-test",title:"Book",author:"Author",language:"en",metadata:{popularTitle:"Book",popularLanguage:"en",title:{es:"Libro",en:"Book"},description:{es:"Texto",en:"Text"},editorialNote:{es:"Nota",en:"Note"},genres:[id],links:{}}}};
    const form=authorFormView(formState);
    assert.match(form,new RegExp(`<input type="checkbox" name="metadata.genres" value="${id}"[^>]*checked>`));
    assert.ok(form.includes(interestIcon(interest)));assert.ok(form.includes(name));
    const preview=authorFormView({...formState,authorForm:{...formState.authorForm,preview:true}});
    assert.ok(preview.includes(`${interestIcon(interest)}${name}`));
  }
});
test("Appearance validation accepts one emoji grapheme and a safe hex color without using an ID map",()=>{
  const interest={id:"future-interest",emoji:"🧑‍💻",color:"#E4EFFB"};
  assert.ok(validInterestAppearance(interest));assert.ok(interestIcon(interest).includes("🧑‍💻"));
  for(const emoji of [undefined,"","🌱💰","Software",'<script>🌱</script>']) assert.equal(validInterestAppearance({...interest,emoji}),false);
  for(const color of [undefined,"","green",'#fff','" onmouseover="x',"#FFFFFF;background:red"]) {
    assert.equal(validInterestAppearance({...interest,color}),false);assert.equal(interestColor({...interest,color}),"");
  }
  assert.equal(interestIcon({emoji:'<img src=x onerror=x>'}),"");
});

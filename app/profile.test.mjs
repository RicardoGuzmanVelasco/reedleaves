import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {profileView,bookshelfView,dailyView} from "./views.mjs";
import {words} from "./i18n.mjs";

async function fixture() {
  const db=openDatabase(":memory:");initializeDatabase(db);await seedCatalog(db);
  try{return prepareCatalog(await readCatalog(db));}finally{db.close();}
}
const profileData={profile:{id:"test-user",name:'<script>Long name</script>',username:"test.user",createdAt:"2026-10-10 12:00:00",counts:{leavesSpent:8,booksRead:2,booksReading:1,decksCompleted:1,decksInProgress:1,cardsReviewed:8,cardsViewed:9,decksCreated:3,cardsCreated:11,quotesCreated:2},mascots:{pot:1,seed:2,seedling:0,sprout:1}},bookshelf:[{bookId:"seven-habits",reading:"read",pending:true,hasReviewing:true,hasReviewed:false,group:"pending"}]};

test("Profiles translate, escape names, link own versus foreign shelves and show all requested statistics",async()=>{
  for(const language of ["es","en"]) {
    const html=profileView({language,profileData,userId:"other"});
    assert.doesNotMatch(html,/<script>|NaN|undefined/);
    for(const key of Object.keys(profileData.profile.counts)) assert.ok(html.includes(words[language][key]),key);
    assert.match(html,/href="#bookshelf\/test-user"/);assert.match(html,/datetime="2026-10-10"/);
    assert.match(profileView({language,profileData,userId:"test-user"}),/href="#bookshelf"/);
    assert.match(profileView({language,profileError:"profileUnavailable"}),new RegExp(words[language].profileUnavailable.replace('.','\\.')));
  }
});

test("Foreign shelf shows target reading/review states without mutation controls or private metadata actions",async()=>{
  const catalog=await fixture(),s={catalog,language:"es",readOnly:true,profileData,userId:"other",openBookId:"seven-habits",bookshelfFilters:{reading:"all",review:"all"}};
  const html=bookshelfView(s);
  assert.match(html,/Solo lectura/);assert.match(html,/value="read" selected/);
  assert.match(html,/Repasando/);assert.match(html,/href="#profile\/test-user"/);
  assert.match(html,/href="#library\/book\/seven-habits"/);
  assert.doesNotMatch(html,/data-book-status|data-action="(?:library|open-book|complete-book|create-book)"/);
  assert.match(bookshelfView({...s,openBookId:null,bookshelfFilters:{reading:"reading",review:"all"}}),/No hay libros con estos filtros/);
});

test("All three card attributions are escaped links with three filled icons and diagonal arrows",async()=>{
  const catalog=await fixture(),card=catalog.allCards[0];
  const s={catalog,language:"es",daily:{id:card.id},preferences:{filters:{},genres:[]},storageAvailable:true};
  const html=dailyView(s),footer=html.slice(html.indexOf('<footer'),html.indexOf('</footer>'));
  assert.equal((footer.match(/class="card-attribution-row"/g)||[]).length,3);
  assert.equal((footer.match(/class="attribution-icon"/g)||[]).length,3);
  assert.equal((footer.match(/class="attribution-arrow"/g)||[]).length,3);
  assert.match(footer,/#library\/book\//);assert.match(footer,/#library\/author\//);assert.match(footer,/#profile\/reed-team/);
  assert.doesNotMatch(footer,/ · /);
});

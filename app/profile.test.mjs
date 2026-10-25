import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
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
const profileData={profile:{id:"test-user",name:'<script>Long name</script>',username:"test.user",createdAt:"2026-10-10 12:00:00",counts:{booksRead:2,booksReading:1,cardsViewed:9,decksCreated:3,cardsCreated:11,quotesCreated:2},mascots:{pot:1,seed:2,root:0,seedling:0,sprout:1}},bookshelf:[{bookId:"seven-habits",reading:"read"}]};

test("Profiles show book, card-view and contribution counts without old per-card progress statistics",async()=>{
  for(const language of ["es","en"]) {
    const html=profileView({language,profileData,userId:"other"});
    assert.doesNotMatch(html,/<script>|NaN|undefined|mascot-face/);
    assert.equal((html.match(/<img class="mascot-icon"/g)||[]).length,7);
    assert.match(html,new RegExp(`<span>${language==="es"?"Germen":"Seedling"}</span><strong>0</strong>`));
    assert.match(html,new RegExp(`<span>${language==="es"?"Brote":"Sprout"}</span><strong>1</strong>`));
    assert.match(html,/<header class="profile-heading"><div class="profile-avatar"/);
    assert.doesNotMatch(html,/data-action="profile-back"|profile-topline/);
    for(const key of Object.keys(profileData.profile.counts)) assert.ok(html.includes(words[language][key]),key);
    assert.match(html,/href="#bookshelf\/test-user"/);assert.match(html,/datetime="2026-10-10"/);
    assert.doesNotMatch(profileView({language,profileData,userId:"test-user"}),/href="#bookshelf(?:\/|")/);
    assert.match(profileView({language,profileError:"profileUnavailable"}),new RegExp(words[language].profileUnavailable.replace('.','\\.')));
  }
});

test("Foreign shelf shows target reading/review states without mutation controls or private metadata actions",async()=>{
  const catalog=await fixture(),s={catalog,language:"es",readOnly:true,profileData,userId:"other",openBookId:"seven-habits"};
  const html=bookshelfView(s);
  assert.match(html,/Solo lectura/);assert.match(html,/data-status="read" aria-pressed="true" disabled/);
    assert.doesNotMatch(html,/Repasando|Tarjetas repasadas|Continuar repaso/);assert.match(html,/href="#profile\/test-user"/);
  assert.match(html,/data-action="open-book" data-book="seven-habits"/);
  const controls=[...html.matchAll(/<button[^>]*data-action="set-book-reading"[^>]*>/g)];
  assert.equal(controls.length,4); assert.ok(controls.every(([tag])=>tag.includes("disabled")));
  assert.doesNotMatch(html,/data-book-status|data-action="(?:library|complete-book|create-book)"/);
  assert.doesNotMatch(html,/open-bookshelf-filters|bookshelf-filter-reading/);
});

test("All three card attributions are escaped links with three filled icons and diagonal arrows",async()=>{
  const catalog=await fixture(),card=catalog.allCards[0];
  const s={catalog,language:"es",daily:{id:card.id,day:"2026-10-06"},dailyToday:{day:"2026-10-06"},dailyHistory:[{id:card.id,day:"2026-10-06"}],selectedDailyDay:"2026-10-06",calendarMonth:"2026-10",storageAvailable:true};
  const html=dailyView({...s,dailyExclusiveCardId:card.id}),footer=html.slice(html.indexOf('<footer'),html.indexOf('</footer>'));
  assert.equal((footer.match(/class="card-attribution-row"/g)||[]).length,3);
  assert.equal((footer.match(/class="attribution-icon"/g)||[]).length,3);
  assert.equal((footer.match(/class="attribution-arrow"/g)||[]).length,3);
  assert.match(footer,/#library\/book\//);assert.match(footer,/#library\/author\//);assert.match(footer,/#profile\/reed-team/);
  assert.doesNotMatch(footer,/ · /);
});

test("Selected daily calendar day exposes its selected state and green style",async()=>{
  const catalog=await fixture(),card=catalog.allCards[0];
  const s={catalog,language:"es",daily:{id:card.id,day:"2026-10-06"},dailyToday:{day:"2026-10-06"},dailyHistory:[{id:card.id,day:"2026-10-06"}],selectedDailyDay:"2026-10-06",calendarMonth:"2026-10",storageAvailable:true};
  const html=dailyView(s),selected=html.match(/<button[^>]*data-action="daily-date"[^>]*aria-pressed="true"[^>]*>/)?.[0];
  assert.ok(selected,"the selected date remains a semantic pressed button");
  assert.match(selected,/is-selected/);
  const styles=readFileSync(new URL("./reader.css",import.meta.url),"utf8");
  assert.match(styles,/\.daily-calendar-day\.has-idea:hover:not\(\.is-selected\)\{background:#fff\}/);
  assert.match(styles,/\.daily-calendar-day\.is-selected\{background:var\(--light\);color:var\(--ink\);/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {profileView,bookshelfView,dailyView} from "./views.mjs";
import {words} from "./i18n.mjs";
import {readerState} from "../test-support/reader-state.mjs";
import {toggleProfileInterest} from "./profile-interests.mjs";

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

test("Profile back injection is a labelled chevron with a full touch target",()=>{
  for(const [language,label] of [["es","Volver"],["en","Back"]]) {
    let injected="";
    profileView({language,profileData,userId:"test-user",showProfileBack:true,injectHeaderLeading:markup=>{injected=markup;}});
    assert.match(injected,new RegExp(`class="icon-button profile-header-back"[^>]*aria-label="${label}"`));
    assert.match(injected,/<svg viewBox="0 0 24 24"[^>]*><path d="m15 18-6-6 6-6"\/><\/svg>/);
  }
});

test("Profile interests show static chips in saved positive then negative order and expose editing only to the owner",async()=>{
  const catalog=await fixture(),preferences={interested:["software","finance"],notInterested:["society"],revision:3};
  for(const language of ["es","en"]) {
    const html=profileView(readerState(catalog,{language,profileData,userId:"test-user",profileInterests:preferences}));
    const section=html.match(/<section[^>]*aria-labelledby="profile-interests-heading"[^>]*>([\s\S]*?)<\/section>/)[1];
    assert.equal((section.match(/class="interest-chip"/g)||[]).length,3);
    assert.doesNotMatch(section,/<h3|profile-interest-position|<ol|<input/);
    assert.ok(section.indexOf("💰")<section.indexOf("🌍"),"positive chips precede negative chips");
    assert.equal((section.match(/class="sr-only"/g)||[]).length,3,"each chip retains its preference for screen readers");
    assert.match(html,new RegExp(words[language].profileInterests));
    assert.match(html,new RegExp(words[language].profileInterested));
    assert.match(html,new RegExp(words[language].profileNotInterested));
    assert.match(html,/profile-interest-mark--interested/);assert.match(html,/profile-interest-mark--notInterested/);
    assert.ok(html.indexOf("💻")<html.indexOf("💰"),"public order follows saved order");
    assert.match(html,/data-action="edit-profile-interests"/);
    assert.doesNotMatch(profileView({language,profileData,userId:"viewer",catalog,profileInterests:null}),/data-action="edit-profile-interests"/);
    assert.doesNotMatch(html,/data-profile-interest=|data-action="save-profile-interests"|pricetag/);

  }
});

test("Another reader's profile renders the public interest payload instead of a loading state",async()=>{
  const catalog=await fixture(),profileInterests={interested:["mindfulness","software"],notInterested:["finance"]};
  const html=profileView({language:"en",profileData,userId:"viewer",catalog,profileInterests});
  assert.match(html,/Mindfulness[\s\S]*Software/);
  assert.match(html,/Finance/);
  assert.doesNotMatch(html,/profile-interests-loading|data-action="edit-profile-interests"/);
  assert.match(html,/profile-interest-mark--interested/);
  assert.match(html,/profile-interest-mark--notInterested/);
});

test("Card language preferences are private to the owner and enforce one selected language in the editor",async()=>{
  const catalog=await fixture(),preferences={languages:["en","es"],options:["en","es","fr-CA"],configured:false,revision:0};
  for(const language of ["es","en"]) {
    const html=profileView({language,profileData,userId:"test-user",catalog,profileLanguages:preferences});
    assert.match(html,new RegExp(words[language].profileLanguages));
    assert.match(html,/english, spanish|inglés, español/i);
    const editor=profileView({language,profileData,userId:"test-user",catalog,profileLanguages:{...preferences,editing:true,draft:["en"]}});
    assert.match(editor,/data-profile-language value="fr-CA"/);
    assert.match(editor,/data-action="save-profile-languages"/);
    assert.match(editor,new RegExp(words[language].profileLanguageChoose));
    assert.match(editor,new RegExp(words[language].profileLanguageRequired));
    const visitor=profileView({language,profileData,userId:"visitor",catalog,profileLanguages:null});
    assert.doesNotMatch(visitor,/data-action="edit-profile-languages"|Card languages|Idiomas de las tarjetas/);
  }
});

test("Profile interest selection appends in click order, moves between lists, and enforces five",()=>{
  let state={interested:["a","b","c"],notInterested:["d"]};
  let change=toggleProfileInterest(state,"b","interested");
  assert.deepEqual(change.state.interested,["a","c"]);
  change=toggleProfileInterest(change.state,"d","interested");
  assert.deepEqual(change.state.interested,["a","c","d"]);assert.deepEqual(change.state.notInterested,[]);assert.equal(change.moved,true);
  change=toggleProfileInterest({interested:["a","b","c","d","e"],notInterested:[]},"f","interested");
  assert.equal(change.changed,false);assert.equal(change.reason,"limit");
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

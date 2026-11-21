import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {READING_GUIDE_MIN_LENGTH,READING_GUIDE_MAX_LENGTH,READING_GUIDE_REWARD_XP} from "../core.mjs";
import {guideMarkup,guideCanSave,guideValid} from "./guia.mjs";

const base={bookId:"b",bookTitle:"Libro",deckId:"reading-guides:b",view:"edit",hasExamples:false,ownId:null,ownLanguage:null,ownText:"",review:"",reason:"",defaultLanguage:"es"};
const long="x".repeat(READING_GUIDE_MIN_LENGTH);
const render=(data={},draft={body:"",language:"es"},c=words.es,error="")=>guideMarkup({data:{...base,...data},draft,error,c});

for(const language of ["es","en"]){
  const c=words[language];
  test(`A guide needs the minimum of characters before it can be saved (${language})`,()=>{
    assert.equal(guideValid("x".repeat(READING_GUIDE_MIN_LENGTH-1)),false);assert.equal(guideValid(long),true);assert.equal(guideValid("x".repeat(READING_GUIDE_MAX_LENGTH+1)),false);
    const short=render({},{body:"corta",language},c),ok=render({},{body:long,language},c);
    assert.match(short,/ui2-count is-short/);assert.match(short,/type="submit" class="ui2-btn" disabled/);
    assert.doesNotMatch(ok,/is-short/);assert.doesNotMatch(ok,/type="submit" class="ui2-btn" disabled/);
    assert.ok(short.includes(String(READING_GUIDE_MIN_LENGTH)));
  });
  test(`Examples only when other people wrote guides; the language shows flags only (${language})`,()=>{
    const none=render({},undefined,c),some=render({hasExamples:true},undefined,c);
    assert.doesNotMatch(none,/guide-examples/);assert.match(some,/data-ui2="guide-examples"/);assert.ok(some.includes(c.ui2GuideExamples));
    assert.doesNotMatch(some,/<span>Español<\/span>/);
  });
  test(`Pending shows the prize on the info callout, rejected the reason apart and locks the language (${language})`,()=>{
    const pending=render({ownId:"c",ownLanguage:"es",ownText:long,review:"pending"},{body:long,language:"es"},c);
    assert.match(pending,/ui2-co--info[^]*ui2-prize-tag[^]*\+30/);assert.ok(READING_GUIDE_REWARD_XP===30);
    assert.match(pending,/data-language="en"[^>]*disabled/);assert.match(pending,/type="submit" class="ui2-btn" disabled/);
    const rejected=render({ownId:"c",ownLanguage:"es",ownText:long,review:"rejected",reason:"Cuenta el argumento"},{body:long+" y más",language:"es"},c);
    assert.match(rejected,/ui2-co--warning[^]*Cuenta el argumento[^]*ui2-co-sub--apart[^]*/);assert.ok(rejected.includes(c.ui2GuideRevision));
    assert.doesNotMatch(rejected,/ui2-prize-tag/);assert.doesNotMatch(rejected,/type="submit" class="ui2-btn" disabled/);
  });
  test(`Approved is read-only with a single action to read the guides; an unread book only warns (${language})`,()=>{
    const approved=render({view:"approved",ownId:"c",ownLanguage:"es",ownText:"Mi guía",review:"approved"},undefined,c);
    assert.ok(approved.includes(c.ui2GuideApproved));assert.doesNotMatch(approved,/<textarea|type="submit"/);assert.match(approved,/href="#preview\/reading-guides%3Ab"/);assert.doesNotMatch(approved,/ui2-prize-tag/);
    const locked=render({view:"locked"},undefined,c);assert.ok(locked.includes(c.readingGuideContribution));assert.doesNotMatch(locked,/<textarea/);
    assert.equal(guideCanSave({...base,ownId:"c",ownText:long},{body:long}),false);
  });
}

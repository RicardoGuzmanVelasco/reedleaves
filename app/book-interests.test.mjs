import test from "node:test";
import assert from "node:assert/strict";
import {bookInterestError,selectBookInterest} from "./book-interests.mjs";
import {syncBookInterestSelector} from "./interests.mjs";
import {normalizeBookMetadata} from "./book-metadata.mjs";
import {authorFormView} from "./views.mjs";
import {words} from "./i18n.mjs";
import {readerState,emptyCatalog} from "../test-support/reader-state.mjs";

test("Book interests validate one to three distinct known IDs without sorting or truncating",()=>{
  const ids=["software","society","finance"],known=new Set(ids);
  assert.equal(bookInterestError(ids,known),null);
  assert.deepEqual(normalizeBookMetadata({genres:ids}).genres,ids);
  assert.equal(bookInterestError([],known),"bookGenreRequired");
  assert.equal(bookInterestError([],known,{required:false}),null);
  for(const invalid of [null,"software",["software","software"],["missing"],[" software"]]) assert.equal(bookInterestError(invalid,known),"bookGenreInvalid");
  const tooMany=[...ids,"productivity"];
  assert.equal(bookInterestError(tooMany),"bookGenreLimit");
  assert.deepEqual(normalizeBookMetadata({genres:tooMany}).genres,tooMany,"historical metadata remains readable");
  assert.equal(bookInterestError(tooMany,undefined,{existingIds:tooMany}),null);
  assert.equal(bookInterestError([...tooMany].reverse(),undefined,{existingIds:tooMany}),"bookGenreLimit");
  assert.strictEqual(selectBookInterest(ids,"productivity",true),ids);
});

test("Selector exposes stable native options, catalog labels and associated localized ordering help",()=>{
  const ids=["finance","society","software","productivity"];
  const catalog={...emptyCatalog(),genres:ids.map(id=>({id,name:{es:`Interés ${id}`,en:`Interest ${id}`},emoji:"🌱",color:"#E4F0CC"}))};
  for(const language of ["es","en"]) for(const selected of [[],["software","finance","society"],["software","society","finance"]]) {
    const html=authorFormView(readerState(catalog,{language,authorForm:{kind:"book",metadata:normalizeBookMetadata({genres:selected})}}));
    assert.deepEqual([...html.matchAll(/name="metadata.genres" value="([^"]+)"/g)].map(match=>match[1]),ids);
    assert.ok(html.includes(words[language].bookInterestHelp));
    assert.match(html,/<fieldset[^>]*data-book-interest-selector[^>]*><legend>/);
    for (const [index,id] of ids.entries()) {
      const option=html.match(new RegExp(`<label class="check-row interest-option"[^>]*><input[^>]*value="${id}"[\\s\\S]*?</label>`))[0];
      assert.ok(option.includes(`aria-labelledby="book-interest-name-${index}"`));
      assert.ok(option.includes(`id="book-interest-name-${index}">${catalog.genres[index].name[language]}</span>`));
      const description=option.match(/<span class="sr-only interest-order-description"[^>]*>/)[0];
      assert.doesNotMatch(description,/aria-hidden/);
      assert.match(option,/<span class="interest-order" aria-hidden="true">/);
    }
    for(const [index,id] of selected.entries()) {
      const option=html.match(new RegExp(`<label class="check-row interest-option"[^>]*><input[^>]*value="${id}"[\\s\\S]*?</label>`))[0];
      assert.ok(option.includes(`>${index+1}</span>`));assert.ok(option.includes(words[language].bookInterestPosition(index+1)));
      assert.match(option,/aria-describedby="book-genre-help/);assert.match(option,/aria-disabled="false"/);
    }
    if(selected.length===3) assert.match(html,/value="productivity"[^>]*aria-disabled="true"/);
    assert.doesNotMatch(html,/type="checkbox"[^>]* disabled/);
  }
});

test("Selection sync updates numbers and accessible positions without replacing or moving controls",()=>{
  const options=["finance","society","software","productivity"].map((value,index)=>{
    const number={textContent:""},description={id:`book-interest-position-${index}`,textContent:""};
    const option={querySelector:selector=>selector===".interest-order"?number:description};
    return {value,number,description,attributes:{},closest:()=>option,setAttribute(name,value){this.attributes[name]=value;}};
  });
  const counter={},limit={},selector={querySelectorAll:()=>options,querySelector:selector=>selector==="[data-interest-count]"?counter:limit};
  const root={querySelector:()=>selector},original=[...options];
  syncBookInterestSelector(root,["software","finance","society"],words.en);
  assert.deepEqual(options.map(input=>input.number.textContent),[2,3,1,""]);
  assert.equal(options[2].description.textContent,words.en.bookInterestPosition(1));
  assert.equal(options[3].attributes["aria-disabled"],"true");assert.equal(limit.hidden,false);assert.equal(counter.textContent,"3 / 3");
  syncBookInterestSelector(root,["software","society"],words.en);
  assert.deepEqual(options.map(input=>input.number.textContent),["",2,1,""]);
  assert.equal(options[0].attributes["aria-disabled"],"false");assert.equal(limit.hidden,true);
  assert.equal(options[2].attributes["aria-describedby"],"book-genre-help book-interest-position-2");
  for(const [index,input] of options.entries()) assert.strictEqual(input,original[index]);
});

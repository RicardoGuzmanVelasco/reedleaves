import test from "node:test";
import assert from "node:assert/strict";
import {isPublicRoute,accessRequest,PERSONAL_ACTIONS} from "./visitor.mjs";
import {headerMarkup} from "./shell.mjs";
import {newAuth} from "./acceso.mjs";
import {words} from "../i18n.mjs";

const lookup={hasBook:id=>id==="b",hasDeck:id=>id==="d"};

test("A visitor sees the Librería, a book page and a deck page, as in the old interface; the rest is Acceso",()=>{
  assert.equal(isPublicRoute({name:"bookstore"},lookup),true);
  assert.equal(isPublicRoute({name:"book",id:"b"},lookup),true);
  assert.equal(isPublicRoute({name:"deck",id:"d",note:false},lookup),true);
  for(const where of [{name:"home"},{name:"library"},{name:"cardcase"},{name:"practice"},{name:"profile",id:"x"},{name:"reader-shelf",id:"x",stage:null},{name:"account"},{name:"book-note",id:"b"},
    {name:"book",id:"gone"},{name:"deck",id:"gone",note:false},{name:"deck",id:"d",note:true}])assert.equal(isPublicRoute(where,lookup),false,JSON.stringify(where));
});

test("Adding a deck starts with sign-up and sorting by interests with sign-in, each with its notice; the other actions only open Acceso",()=>{
  assert.deepEqual(accessRequest({intent:{kind:"add-deck",deck:"d"},returnHash:"#deck/d"}),{mode:"register",notice:"accountLearningNotice",returnHash:"#deck/d",intent:{kind:"add-deck",deck:"d"}});
  assert.equal(accessRequest({intent:{kind:"sort-interests"},returnHash:"#bookstore"}).notice,"interestSortSignInNotice");
  for(const kind of ["book-status","catalog-book","create-deck"])assert.deepEqual([PERSONAL_ACTIONS[kind].mode,PERSONAL_ACTIONS[kind].notice],["login",null]);
  for(const language of ["es","en"])for(const entry of Object.values(PERSONAL_ACTIONS))assert.ok(!entry.notice||typeof words[language][entry.notice]==="string");
});

test("The header's Entrar returns to where the visitor was, and never to Acceso itself",()=>{
  assert.equal(accessRequest({returnHash:"#book/b"}).returnHash,"#book/b");
  for(const hash of ["#account","",undefined])assert.equal(accessRequest({returnHash:hash}).returnHash,"#home");
  assert.equal(newAuth().returnHash,null);
});

test("A visitor's header has the Entrar button and neither avatar nor balances",()=>{
  const html=headerMarkup({userId:null,wallet:{leaves:0,petals:0},c:words.en});
  assert.match(html,/data-ui2="sign-in"[^>]*>Sign in</);
  assert.doesNotMatch(html,/ui2-avatar|ui2-wallet|profile/);
  assert.match(headerMarkup({userId:"u",stage:"sprout",wallet:{leaves:1,petals:2},c:words.en}),/ui2-avatar[^]*ui2-wallet/);
});

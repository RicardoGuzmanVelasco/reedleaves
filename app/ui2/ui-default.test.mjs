import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {startReader} from "../reader-app.mjs";
import {deckShareUrl,cardShareUrl} from "../deck-navigation.mjs";
import {perfilData,perfilMarkup} from "./perfil.mjs";
import {navMarkup,headerMarkup} from "./shell.mjs";
import {accesoMarkup,newAuth} from "./acceso.mjs";
import {emptyMarkup,readerShelfData,readerShelfMarkup} from "./biblioteca.mjs";
import {emptyCatalog} from "../../test-support/reader-state.mjs";
import {bookstoreCoverMarkup} from "./libreria.mjs";
import {coverMarkup} from "./home.mjs";

// The old interface is out of reach: every in-app link stays inside this one (a hash route) or leaves the app (http).
const hrefs=html=>[...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(match=>match[1]);
const staysInside=html=>{for(const href of hrefs(html))assert.match(href,/^(#|https?:)/,href);assert.doesNotMatch(html,/[?&]ui=/);};

test("The new interface opens whatever the URL says: no parameter or route chooses the old one",async()=>{
  const previous=globalThis.location;
  try{
    for(const [search,hash] of [["",""],["?ui=2","#home"],["?ui=1","#library"],["?ui=","#daily-idea"],["?sharedCard=x&cardLanguage=es","#card/x/es"]]){
      globalThis.location={search,hash,pathname:"/app/",href:`https://reedleaves.com/app/${search}${hash}`};
      const main={id:"main"},mounted=[];
      await startReader({load:async()=>({mountUi2:options=>{mounted.push(options);}}),doc:{getElementById:id=>id==="main"?main:null}});
      assert.equal(mounted.length,1,search);assert.equal(mounted[0].main,main);
    }
  }finally{globalThis.location=previous;}
});

test("Shared links carry no interface switch and old links with ?ui=2 still open the same card or deck",()=>{
  for(const from of ["https://reedleaves.com/app/#home","https://reedleaves.com/app/?ui=2#edit/d"]){
    const deck=new URL(deckShareUrl(from,"d")),card=new URL(cardShareUrl(from,"c","es"));
    assert.equal(deck.searchParams.has("ui"),false);assert.equal(deck.hash,"#preview/d");
    assert.equal(card.searchParams.has("ui"),false);assert.equal(card.hash,"#card/c/es");
  }
});

const interests=[{id:"focus",name:{es:"Enfoque",en:"Focus"},emoji:"🧠",chipColor:"#ff6e9e",bookColor:"#ff6e9e"}];
const profile=id=>({id,name:"Ana",username:"ana",createdAt:"2026-10-10 08:00:00",readerProgression:{level:2,stage:"sprout",fullName:"Brote",xp:10,xpIntoLevel:10,xpForNextLevel:100},
  counts:{booksRead:1,booksReading:1,cardsViewed:1,decksCreated:1,cardsCreated:1,quotesCreated:0},mascots:{}});
const book={id:"b 1",title:"Libro",titleLanguage:"es",author:"Autora",status:"reading",stage:"sprout",deckId:""};

for(const language of ["es","en"]){
  const c=words[language];
  test(`No screen of the new interface links to the old one (${language})`,()=>{
    staysInside(navMarkup({active:"home",c}));
    staysInside(headerMarkup({userId:"me",stage:"sprout",wallet:{leaves:1,petals:1},c})+headerMarkup({userId:null,c}));
    staysInside(accesoMarkup({auth:newAuth(),c})+emptyMarkup(c.emptyCardcase,c));
    staysInside(coverMarkup(book,c)+bookstoreCoverMarkup(book,c));
    assert.ok(hrefs(coverMarkup(book,c)+bookstoreCoverMarkup(book,c)).every(href=>href==="#book/b%201"));
    for(const viewerId of ["me","ana"])staysInside(perfilMarkup({data:perfilData({profile:profile("ana"),prefs:{interested:[],notInterested:[]},interests,viewerId,language}),c,language}));
  });

  test(`«${c.viewShelf}» opens that reader's Estantería in this interface (${language})`,()=>{
    const other=perfilMarkup({data:perfilData({profile:profile("ana"),prefs:{interested:[],notInterested:[]},interests,viewerId:"me",language}),c,language});
    const shelf=other.match(/<(a|button)\b[^>]*>(?:(?!<\/\1>).)*?<span>([^<]*)<\/span><\/\1>/gs).find(control=>control.includes(c.viewShelf));
    assert.ok(shelf);assert.match(shelf,/^<a\b[^>]*href="#library\/ana"/);assert.doesNotMatch(shelf,/coming-soon/);
    const books={...emptyCatalog(),booksById:new Map([["b 1",{id:"b 1",title:{es:"Libro"},author:"Autora"}]])};
    staysInside(readerShelfMarkup({data:readerShelfData({catalog:books,profile:profile("ana"),bookshelf:[{bookId:"b 1",reading:"reading",stage:"pot"}],language}),views:{},c}));
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import {updateNavigationBadges} from "./navigation-badges.mjs";

function fixture(){
  const links=new Map();
  const root={querySelector:selector=>links.get(selector.match(/data-nav="([^"]+)"/)[1])};
  for(const name of ["bookstore","daily-idea"]){
    const attributes=new Map(),children=[];
    const link={attributes,children,setAttribute:(key,value)=>attributes.set(key,value),querySelector:()=>children[0],append:badge=>children.push(badge),ownerDocument:{createElement:()=>({setAttribute(key,value){this[key]=value;},remove(){children.splice(0,children.length);}})}};
    links.set(name,link);
  }
  return {root,links};
}
test("both navigation badges share one noninteractive mark and localized accessible status",()=>{
  for(const language of ["es","en"]){
    const {root,links}=fixture();
    updateNavigationBadges(root,{language,bookstoreCount:1234,dailyIdeaUnseen:true});
    const bookstore=links.get("bookstore"),dailyIdea=links.get("daily-idea");
    assert.match(bookstore.attributes.get("aria-label"),/1234/);
    assert.match(bookstore.attributes.get("aria-label"),language==="es"?/Librería.*libros nuevos/:/Bookstore.*new books/);
    assert.equal(dailyIdea.attributes.get("aria-label"),language==="es"?"Nueva idea del día":"New daily idea");
    assert.equal(bookstore.children[0].className,dailyIdea.children[0].className);
    assert.equal(bookstore.children[0]["aria-hidden"],"true");
    const mark=bookstore.children[0];
    updateNavigationBadges(root,{language,bookstoreCount:1,dailyIdeaUnseen:false});
    assert.equal(bookstore.children[0],mark,"rerender keeps the mark and does not restart its animation");
    assert.equal(bookstore.attributes.get("aria-label"),language==="es"?"Librería, 1 libro nuevo":"Bookstore, 1 new book");
    assert.equal(dailyIdea.children.length,0);
    assert.equal(dailyIdea.attributes.get("aria-label"),language==="es"?"Idea del día":"Daily idea");
    updateNavigationBadges(root,{language});
    assert.equal(bookstore.children.length,0);
    assert.equal(bookstore.attributes.get("aria-label"),language==="es"?"Librería":"Bookstore");
  }
});

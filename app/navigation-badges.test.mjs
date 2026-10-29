import test from "node:test";
import assert from "node:assert/strict";
import {updateNavigationBadges} from "./navigation-badges.mjs";

function fixture(){
  const links=new Map();
  const root={querySelector:selector=>links.get(selector.match(/data-nav="([^"]+)"/)[1])};
  for(const name of ["library","daily"]){
    const attributes=new Map(),children=[];
    const link={attributes,children,setAttribute:(key,value)=>attributes.set(key,value),querySelector:()=>children[0],append:badge=>children.push(badge),ownerDocument:{createElement:()=>({setAttribute(key,value){this[key]=value;},remove(){children.splice(0,children.length);}})}};
    links.set(name,link);
  }
  return {root,links};
}
test("both navigation badges share one noninteractive mark and localized accessible status",()=>{
  for(const language of ["es","en"]){
    const {root,links}=fixture();
    updateNavigationBadges(root,{language,libraryCount:1234,dailyUnseen:true});
    const library=links.get("library"),daily=links.get("daily");
    assert.match(library.attributes.get("aria-label"),/1234/);
    assert.match(library.attributes.get("aria-label"),language==="es"?/Librería.*libros nuevos/:/Library.*new books/);
    assert.equal(daily.attributes.get("aria-label"),language==="es"?"Nueva idea del día":"New daily idea");
    assert.equal(library.children[0].className,daily.children[0].className);
    assert.equal(library.children[0]["aria-hidden"],"true");
    const mark=library.children[0];
    updateNavigationBadges(root,{language,libraryCount:1,dailyUnseen:false});
    assert.equal(library.children[0],mark,"rerender keeps the mark and does not restart its animation");
    assert.equal(library.attributes.get("aria-label"),language==="es"?"Librería, 1 libro nuevo":"Library, 1 new book");
    assert.equal(daily.children.length,0);
    assert.equal(daily.attributes.get("aria-label"),language==="es"?"Idea del día":"Daily idea");
    updateNavigationBadges(root,{language});
    assert.equal(library.children.length,0);
    assert.equal(library.attributes.get("aria-label"),language==="es"?"Librería":"Library");
  }
});

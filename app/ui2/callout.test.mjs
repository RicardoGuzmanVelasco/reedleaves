import test from "node:test";
import assert from "node:assert/strict";
import {ui2Callout} from "./callout.mjs";

test("Each kind has its own icon; an error is always announced as an alert, never as a status",()=>{
  for(const [kind,icon] of [["error","alert"],["warning","warning"],["tip","idea"],["info","info"]]){
    const html=ui2Callout({kind,main:"Texto",role:"status"});
    assert.match(html,new RegExp(`ui2-co--${kind}[^>]*role="${kind==="error"?"alert":"status"}"[^]*data-icon="${icon}"[^]*Texto`));
  }
  assert.doesNotMatch(ui2Callout({kind:"error",main:"x",role:"status"}),/role="status"|aria-live/);
  assert.match(ui2Callout({kind:"warning",main:"x",role:"alert"}),/role="alert"/);
});

test("Main text, sub texts, own content and one action; the text is escaped and the id goes on the main text",()=>{
  const html=ui2Callout({kind:"info",main:"<b>a</b>",sub:["uno","dos"],extra:"<i>extra</i>",id:"m",action:{label:"Ir",attrs:'data-ui2="go"',disabled:true}});
  assert.match(html,/id="m">&lt;b&gt;a&lt;\/b&gt;<\/p>/);assert.match(html,/uno[^]*dos[^]*<i>extra<\/i>/);
  assert.match(html,/<button type="button" class="ui2-co-btn" data-ui2="go" disabled>Ir<\/button>/);
  assert.equal(html.match(/<button/g).length,1);
});

test("Only a tip carries the prize tag, in the row of the main text",()=>{
  const prize='<span class="ui2-prize-tag">+3</span>';
  assert.match(ui2Callout({kind:"tip",main:"Premio",prize}),/ui2-co-row[^]*Premio[^]*ui2-prize-tag/);
  for(const kind of ["error","warning","info"])assert.doesNotMatch(ui2Callout({kind,main:"x",prize}),/ui2-prize-tag/);
});

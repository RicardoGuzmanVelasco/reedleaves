import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {errorScreenMarkup,errorScreenContent,ERROR_SCREEN_MESSAGE_ID} from "./error-screen.mjs";
import {blockingFailure} from "./errors.mjs";

for(const language of ["es","en"])test(`Error screen: blocking alertdialog with the sad sprout, the message and Retry (${language})`,()=>{
  const c=words[language],html=errorScreenMarkup({message:c.connectionError,c});
  assert.match(html,/<dialog[^>]*role="alertdialog"/);
  assert.match(html,/aria-modal="true"/);
  assert.match(html,new RegExp(`aria-label="${c.ui2ErrorTitle}"`));
  assert.match(html,new RegExp(`aria-describedby="${ERROR_SCREEN_MESSAGE_ID}"`));
  assert.match(html,/data-mascot="sprout"[^>]*data-idle="sob"/);
  assert.match(html,/callout--error[^>]*role="alert"/);
  assert.match(html,new RegExp(`id="${ERROR_SCREEN_MESSAGE_ID}"[^>]*>.*${c.connectionError}`));
  assert.match(html,new RegExp(`<button type="button"[^>]*data-errscreen="retry"[^>]*autofocus>${c.retry}</button>`));
  assert.ok(c.ui2Retrying&&c.ui2ErrorTitle);
});

test("Error screen while retrying: the sleeping sprout waits with its label, without Retry",()=>{
  const c=words.es,html=errorScreenMarkup({message:c.connectionError,c,waiting:true});
  assert.match(html,/data-state="waiting"/);assert.match(html,/aria-busy="true"/);
  assert.doesNotMatch(html,/aria-describedby/);
  assert.match(html,/data-idle="sleep"/);assert.match(html,/role="status"/);
  assert.match(html,new RegExp(`${c.ui2Retrying}<span class="loading-dots"`));
  assert.doesNotMatch(html,/data-errscreen="retry"|data-idle="sob"/);
});

test("Error screen escapes the message",()=>{
  assert.match(errorScreenContent({message:"<b>x</b>",c:words.es}),/&lt;b&gt;x&lt;\/b&gt;/);
});

test("Only missing connection and server errors block the screen",()=>{
  assert.equal(blockingFailure({code:"connectionError"}),true);
  assert.equal(blockingFailure({code:"x",status:503}),true);
  assert.equal(blockingFailure(null),true);
  for(const failure of [{code:"insufficientPetals"},{code:"deckReadOnly",status:409},{code:"invalidRequest",status:400}])assert.equal(blockingFailure(failure),false);
});

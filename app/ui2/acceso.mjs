// Acceso: sign in and create account, in the new interface. Pure markup and state helpers; index.mjs owns the requests.
// A visitor reaches it from a personal action (`notice`: the reason, as the old interface words it) or from the header;
// `returnHash` is where they come back to once signed in and `intent` the action to finish then.
// Credentials errors are callouts (never loose red text); connection and server errors go to the error screen.
import {escapeHtml as esc} from "../views.mjs";
import {mascotArt} from "../mascot-art.mjs?v=tumbleweed";
import {USERNAME_MIN_LENGTH,USERNAME_MAX_LENGTH,PASSWORD_MIN_LENGTH,PASSWORD_MAX_LENGTH,INVITE_CODE_MIN_LENGTH} from "../core.mjs";
import {icon} from "./icons.mjs";
import {ui2Callout} from "./callout.mjs";

export const newAuth=(extra={})=>({mode:"login",username:"",password:"",invite:"",busy:false,error:null,suggest:false,created:false,notice:null,returnHash:null,intent:null,...extra});

// Which field is marked red for an error from the server.
export const authErrorField=code=>code==="invalidCredentials"?"password":code==="usernameTaken"?"username":/invite/i.test(code||"")?"invite":null;

// The server's `invalidCredentials` on sign in may mean the account does not exist: offer to create it with the same data.
export const createFromSignIn=auth=>({...auth,mode:"register",error:null,suggest:false,created:true});
export const toggleMode=auth=>({...auth,mode:auth.mode==="login"?"register":"login",error:null,suggest:false,created:false});

// Button to go to the Librería: secondary, as wide as its content, on two lines (the "\n" of the translation).
export const lookAroundMarkup=({c,href="#bookstore"})=>`<a class="ui2-btn secondary--subtle ui2-explore" href="${esc(href)}">${icon("bookstore")}<span>${esc(c.ui2LookAround).replace("\n","<br>")}</span></a>`;

function field({id,name,label,type="text",value="",hint="",invalid=false,attrs=""}){
  return `<div class="ui2-field ui2-auth-field${invalid?" is-error":""}"><label for="${id}">${esc(label)}</label>`
    +`<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}${invalid?' aria-invalid="true"':""}${hint?` aria-describedby="${id}-h"`:""}>${hint?`<small id="${id}-h">${esc(hint)}</small>`:""}</div>`;
}

export function accesoMarkup({auth,inviteRequired=false,c}){
  const signup=auth.mode==="register",invalid=authErrorField(auth.error);
  const message=auth.error?(typeof c[auth.error]==="string"?c[auth.error]:c.connectionError):"";
  const callouts=(auth.notice&&typeof c[auth.notice]==="string"?ui2Callout({kind:"tip",role:"status",text:c[auth.notice]}):"")
    +(auth.error?ui2Callout({kind:auth.error==="sessionExpired"?"warning":"error",role:"alert",text:message}):"")
    +(auth.suggest?ui2Callout({kind:"tip",role:"status",html:`<p><strong class="ui2-co-title">${esc(c.ui2CreatingAccount)}</strong></p><button type="button" class="ui2-btn ui2-co-btn" data-ui2="auth-create">${esc(c.signUp)}</button>`}):"")
    +(auth.created?ui2Callout({kind:"tip",role:"status",html:`<p><strong class="ui2-co-title">${esc(c.ui2CompleteFields)}</strong></p>`}):"");
  const form=`<form class="ui2-auth-form" data-ui2-auth aria-busy="${auth.busy}"><fieldset${auth.busy?" disabled":""}>`
    +field({id:"ui2-au-user",name:"username",label:c.username,value:auth.username,hint:signup?c.usernameRegistrationHint:c.usernameHint,invalid:invalid==="username",
      attrs:`autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="${USERNAME_MIN_LENGTH}" maxlength="${USERNAME_MAX_LENGTH}" pattern="[a-zA-Z0-9][a-zA-Z0-9._\\-]{${USERNAME_MIN_LENGTH-1},${USERNAME_MAX_LENGTH-1}}"`})
    +(signup&&inviteRequired?field({id:"ui2-au-invite",name:"inviteCode",label:c.inviteCode,type:"password",value:auth.invite,invalid:invalid==="invite",attrs:`autocomplete="off" required minlength="${INVITE_CODE_MIN_LENGTH}" maxlength="256"`}):"")
    +field({id:"ui2-au-pass",name:"password",label:c.password,type:"password",value:auth.password,hint:c.passwordHint,invalid:invalid==="password",
      attrs:`autocomplete="${signup?"new-password":"current-password"}" required minlength="${PASSWORD_MIN_LENGTH}" maxlength="${PASSWORD_MAX_LENGTH}"`})
    +`</fieldset><button type="submit" class="ui2-btn ui2-auth-submit"${auth.busy?" disabled":""}>${esc(auth.busy?c.working:signup?c.signUp:c.signIn)}</button></form>`;
  return `<section class="ui2-auth"><div class="ui2-auth-head">${mascotArt("sprout","ui2-auth-mascot")}<h1 tabindex="-1">${esc(signup?c.signUp:c.signIn)}</h1></div>${callouts}${form}`
    +`<button type="button" class="text-button ui2-auth-switch" data-ui2="auth-toggle"${auth.busy?" disabled":""}>${esc(signup?c.switchToSignIn:c.switchToSignUp)}</button>${lookAroundMarkup({c})}</section>`;
}

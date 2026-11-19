import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {newAuth,authErrorField,createFromSignIn,toggleMode,accesoMarkup,lookAroundMarkup} from "./acceso.mjs";

const render=(auth,{language="es",inviteRequired=false}={})=>accesoMarkup({auth:{...newAuth(),...auth},inviteRequired,c:{...words[language],legacy:"/app/"}});

for(const language of ["es","en"])test(`Sign in: title, both fields with their hints, one primary button, switch and the Librería button (${language})`,()=>{
  const c=words[language],html=render({},{language});
  assert.match(html,new RegExp(`<h1[^>]*>${c.signIn}</h1>`));
  assert.match(html,/name="username"[^>]*autocomplete="username"/);assert.match(html,/name="password"[^>]*autocomplete="current-password"/);
  assert.ok(html.includes(c.usernameHint)&&html.includes(c.passwordHint));
  assert.doesNotMatch(html,/inviteCode|callout/);
  assert.ok(html.includes(`data-ui2="auth-toggle">${c.switchToSignUp}`));
  assert.match(html,/class="ui2-btn secondary--subtle ui2-explore" href="#bookstore">[^]*data-icon="bookstore"/);
  assert.equal(c.ui2LookAround.split("\n").length,2);
});

test("Create account: the invitation code only shows when the server asks for it",()=>{
  assert.doesNotMatch(render({mode:"register"}),/inviteCode/);
  const html=render({mode:"register"},{inviteRequired:true});
  assert.match(html,/name="inviteCode" type="password"/);
  assert.match(html,/autocomplete="new-password"/);assert.match(html,new RegExp(words.es.usernameRegistrationHint.slice(0,20)));
  assert.ok(html.indexOf('name="username"')<html.indexOf('name="inviteCode"')&&html.indexOf('name="inviteCode"')<html.indexOf('name="password"'));
});

test("Wrong credentials: an error callout, the password marked, and the tip to create the account with the same data",()=>{
  const html=render({username:"lucia",password:"x".repeat(10),error:"invalidCredentials",suggest:true});
  assert.match(html,/callout--error[^]*data-icon="alert"[^]*Revisa el usuario y la contraseña\./);
  assert.match(html,/callout--info[^]*data-icon="idea"[^]*¿Estás creando una cuenta\?[^]*data-ui2="auth-create">Crear cuenta/);
  assert.match(html,/name="password"[^>]*aria-invalid="true"/);assert.doesNotMatch(html,/name="username"[^>]*aria-invalid/);
  assert.equal(authErrorField("usernameTaken"),"username");assert.equal(authErrorField("inviteCodeInvalid"),"invite");assert.equal(authErrorField("tryLater"),null);
  const next=createFromSignIn({...newAuth(),username:"lucia",password:"secret-pass",error:"invalidCredentials",suggest:true});
  assert.deepEqual([next.mode,next.username,next.password,next.error,next.suggest,next.created],["register","lucia","secret-pass",null,false,true]);
  const created=render(next);
  assert.match(created,/callout--info[^]*¡Completa el resto de campos y crea tu cuenta!/);assert.doesNotMatch(created,/callout--error|auth-create/);
  assert.equal(toggleMode(next).mode,"login");assert.equal(toggleMode(next).created,false);
});

test("Session ended is a warning (orange, alert) with the username kept; signing in shows the busy label and locks the form",()=>{
  const ended=render({username:"lucia",error:"sessionExpired"});
  assert.match(ended,/callout--warning[^]*data-icon="alert"[^]*La sesión ha terminado\. Vuelve a entrar\./);assert.match(ended,/value="lucia"/);
  const busy=render({username:"lucia",password:"secret-pass",busy:true});
  assert.match(busy,/<fieldset disabled>/);assert.match(busy,/type="submit" class="ui2-btn ui2-auth-submit" disabled>Un momento…/);
});

test("The Librería button is secondary and carries its icon",()=>{
  assert.match(lookAroundMarkup({c:words.en}),/secondary--subtle[^]*data-icon="bookstore"[^]*Have a look around<br>the bookstore/);
});

test("A personal action opens Acceso with its reason as a tip callout, in the old interface's words",()=>{
  for(const language of ["es","en"]){
    const c=words[language];
    assert.match(render({notice:"accountLearningNotice",mode:"register"},{language}),new RegExp(`callout--info[^]*data-icon="idea"[^]*${c.accountLearningNotice}`));
    assert.ok(render({notice:"interestSortSignInNotice"},{language}).includes(c.interestSortSignInNotice));
  }
  assert.doesNotMatch(render({}),/callout/);
});

// Ajustes: interface language, card languages, tinted covers, feedback and sign out, in a sheet over the Perfil
// (a centred modal on desktop). Interests are edited from the Perfil. Pure markup; the state lives in index.mjs.
import {escapeHtml as esc} from "../views.mjs";
import {ui2Callout} from "./callout.mjs";
import {loadingPlaceholder} from "../loading-placeholder.mjs";
import {languageDisplayName,FEEDBACK_MESSAGE_MAX_LENGTH} from "../core.mjs";
import {icon} from "./icons.mjs";
import {flag} from "./book-sheet.mjs";
import {DECK_LANGUAGES} from "./forms.mjs";

const TINTS=[["off","coverTintOff"],["mono","coverTintMono"],["poly","coverTintPoly"]];
const TINT_HINTS={off:"coverTintHintOff",mono:"coverTintHintMono",poly:"coverTintHintPoly"};

// The interface language is the same selector as the deck language of the deck form.
const languageSwitch=({language,c})=>`<section class="st-sec"><span class="ui2-flabel" id="ui2-st-lang">${esc(c.language)}</span><div class="segmented-selector library-switch ui2-lang-switch" role="group" aria-labelledby="ui2-st-lang">`
  +DECK_LANGUAGES.map(([code,name])=>`<button type="button" data-ui2="set-language" data-language="${code}" aria-pressed="${language===code}" lang="${code}">${flag(code)}<span>${name}</span></button>`).join("")+`</div></section>`;

// Reading: only flag chips (the name is for assistive technology). Editing: a checkbox per language, with its name.
function cardLanguages({cards,edit,language,c}){
  const head=action=>`<div class="st-head"><h3 class="ui2-flabel">${esc(c.profileLanguages)}</h3>${action}</div>`;
  if(!cards)return `<section class="st-sec">${head("")}<div class="st-loading">${loadingPlaceholder(c.busyOpening)}</div></section>`;
  if(!edit){
    const chips=cards.languages.map(code=>`<span class="dp-chip" role="img" aria-label="${esc(languageDisplayName(code,language))}">${flag(code)}</span>`).join("");
    return `<section class="st-sec">${head(`<button type="button" class="ui2-btn secondary--subtle st-edit" data-ui2="edit-languages" aria-label="${esc(c.edit)}">${icon("edit")}</button>`)}`
      +`<div class="dp-chips st-flags" role="group" aria-label="${esc(c.profileLanguages)}">${chips}</div>`
      +`</section>`;
  }
  const options=(cards.options||edit.draft).map(code=>`<label class="st-langopt"><input type="checkbox" data-ui2-card-language value="${esc(code)}"${edit.draft.includes(code)?" checked":""}>${flag(code)}<span lang="${esc(code)}">${esc(languageDisplayName(code,language))}</span></label>`).join("");
  const empty=!edit.draft.length;
  return `<section class="st-sec">${head("")}<fieldset class="st-langs"><legend class="st-hint">${esc(c.profileLanguageChoose)}</legend><div class="st-langopts">${options}</div></fieldset>`
    +`<div data-st-languages-error>${empty?ui2Callout({kind:"error",main:c.profileLanguageRequired}):""}</div>`
    +(edit.conflict?ui2Callout({kind:"warning",role:"alert",main:c.profileLanguagesConflict,action:{label:c.profileLanguagesRecover,attrs:'data-ui2="recover-languages"'}}):"")
    +`<div class="st-actions"><button type="button" class="ui2-btn secondary--subtle" data-ui2="cancel-languages">${esc(c.cancel)}</button><button type="button" class="ui2-btn" data-ui2="save-languages"${empty||edit.conflict?" disabled":""}>${esc(c.save)}</button></div></section>`;
}

// While checking boxes the sheet is not repainted (it would lose the focus): only the error and Save follow the draft.
export function syncCardLanguages(root,draft,c){
  const slot=root.querySelector("[data-st-languages-error]"),save=root.querySelector('[data-ui2="save-languages"]');
  if(slot)slot.innerHTML=draft.length?"":ui2Callout({kind:"error",main:c.profileLanguageRequired});
  if(save)save.disabled=!draft.length;
}

const coverTint=({tint,c})=>`<section class="st-sec"><fieldset class="cover-tint-setting"><legend class="ui2-flabel">${esc(c.coverTint)}</legend><div class="segmented-selector cover-tint-options">`
  +TINTS.map(([value,key])=>`<label><input type="radio" name="cover-tint" value="${value}"${tint===value?" checked":""} aria-describedby="ui2-st-tint-hint"><span>${esc(c[key])}</span></label>`).join("")
  +`</div><p class="st-hint" id="ui2-st-tint-hint" aria-live="polite">${esc(c[TINT_HINTS[tint]])}</p></fieldset></section>`;

export function settingsMarkup({settings,language,tint,c}){
  const body=languageSwitch({language,c})+cardLanguages({cards:settings.cards,edit:settings.edit,language,c})+coverTint({tint,c})
    +`<button type="button" class="ui2-btn secondary--subtle" data-ui2="open-feedback" aria-haspopup="dialog"><span>${esc(c.feedback)}</span></button>`
    +`<button type="button" class="ui2-btn danger st-out" data-ui2="open-sign-out" aria-haspopup="alertdialog"><span>${esc(c.signOut)}</span></button>`;
  return `<dialog class="ui2-sheet ui2-fsheet ui2-settings" data-ui2-sheet aria-labelledby="ui2-st-title"><button type="button" class="dialog-close dialog-close--float" data-ui2="settings-close" aria-label="${esc(c.closeSettings)}">${icon("close")}</button>`
    +`<div class="ui2-grab" aria-hidden="true"></div><div class="ui2-fsheet-form"><div class="ui2-fsheet-head"><h2 id="ui2-st-title">${esc(c.settings)}</h2></div><div class="ui2-fsheet-body st-body">${body}</div></div></dialog>`;
}

export const feedbackMarkup=({feedback,c})=>`<dialog class="ui2-errdialog ui2-feedbackdialog" data-ui2-modal aria-labelledby="ui2-fb-title"><div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="feedback-close" aria-label="${esc(c.closeFeedback)}">${icon("close")}</button>`
  +`<form class="ui2-errpanel ui2-finishpanel" data-ui2-feedback novalidate><h2 id="ui2-fb-title">${esc(c.feedback)}</h2><div class="ui2-field"><label for="ui2-fb-message">${esc(c.feedbackLabel)}</label>`
  +`<textarea id="ui2-fb-message" name="message" rows="5" maxlength="${FEEDBACK_MESSAGE_MAX_LENGTH}" autocomplete="off">${esc(feedback.message)}</textarea></div>`
  +`<div class="ui2-erractions"><button type="submit" class="ui2-btn"${feedback.message.trim()?"":" disabled"}>${esc(c.feedbackSend)}</button></div></form></div></dialog>`;

// C1: signing out does not delete anything, so the confirmation says so and the confirming button is the red one.
export const signOutMarkup=c=>`<dialog class="ui2-errdialog ui2-signoutdialog" data-ui2-modal role="alertdialog" aria-labelledby="ui2-so-title"><div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="sign-out-cancel" aria-label="${esc(c.cancel)}">${icon("close")}</button>`
  +`<div class="ui2-errpanel ui2-finishpanel"><h2 id="ui2-so-title">${esc(c.ui2SignOutTitle)}</h2>${ui2Callout({kind:"info",main:c.ui2SignOutNote})}`
  +`<div class="actions-row"><button type="button" class="ui2-btn secondary--subtle" data-ui2="sign-out-cancel">${esc(c.cancel)}</button><button type="button" class="ui2-btn danger" data-ui2="sign-out-confirm">${esc(c.signOut)}</button></div></div></div></dialog>`;

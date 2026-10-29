import {MAX_BOOK_INTERESTS} from "./book-interests.mjs";
// Appearance belongs to the catalog. No interest-ID map lives in the client.
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const graphemes=new Intl.Segmenter(undefined,{granularity:"grapheme"});
export const validInterestEmoji=emoji=>typeof emoji === "string" && emoji.length <= 32 &&
  /\p{Extended_Pictographic}/u.test(emoji) && [...graphemes.segment(emoji)].length === 1;
export const validInterestColor=color=>typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
export const validInterestAppearance=interest=>validInterestEmoji(interest?.emoji) && validInterestColor(interest?.color);

export function interestIcon(interest) {
  return validInterestEmoji(interest?.emoji) ? `<span class="interest-emoji" aria-hidden="true">${esc(interest.emoji)}</span>` : "";
}
export function interestColor(interest) {
  return validInterestColor(interest?.color) ? ` data-interest-color="${interest.color}"` : "";
}

// Update only state and descriptions: checkbox nodes, focus and option order stay put.
export function syncBookInterestSelector(root,selected,c) {
  const selector=root?.querySelector("[data-book-interest-selector]");
  if (!selector) return;
  for (const input of selector.querySelectorAll('[name="metadata.genres"]')) {
    const position=selected.indexOf(input.value)+1;
    input.checked=position>0;
    input.setAttribute("aria-disabled",String(!position && selected.length>=MAX_BOOK_INTERESTS));
    const option=input.closest(".interest-option");
    const description=option.querySelector(".interest-order-description");
    input.setAttribute("aria-describedby",`book-genre-help ${selected.length>=MAX_BOOK_INTERESTS ? "book-interest-limit " : ""}${description.id}`);
    option.querySelector(".interest-order").textContent=position || "";
    description.textContent=position ? c.bookInterestPosition(position) : "";
  }
  selector.querySelector("[data-interest-count]").textContent=`${selected.length} / ${MAX_BOOK_INTERESTS}`;
  selector.querySelector("[data-interest-limit]").hidden=selected.length<MAX_BOOK_INTERESTS;
}

// CSSOM preserves the app's style-src 'self' policy; inline style attributes are blocked.
export function mountInterests(root) {
  for (const element of root.querySelectorAll("[data-interest-color]")) {
    const color=element.dataset.interestColor;
    if (validInterestColor(color)) element.style.setProperty("--interest-color",color);
  }
  // Touch browsers do not consistently apply :active to a native checkbox label.
  for (const option of root.querySelectorAll(".interest-option")) {
    const release=()=>option.classList.remove("is-pressed");
    option.addEventListener("pointerdown",event=>{
      if (event.button === 0 && !option.querySelector("input")?.matches(":disabled")) option.classList.add("is-pressed");
    });
    for (const event of ["pointerup","pointercancel","pointerleave"]) option.addEventListener(event,release);
  }
}

// Shared by the compact profile editor and the expressive initial selection.
export function readerInterestSelector({catalog,language,c,kind,selected,prefix="profile",expressive=false,disabled=false}) {
  const scope=`${prefix}-interest-${kind}`;
  return `<fieldset class="profile-interest-selector${expressive?" initial-interest-selector":""}" ${disabled?"disabled":""}><legend${expressive?' class="sr-only"':""}>${esc(c[kind==="interested"?"profileSelectInterested":"profileSelectNotInterested"])}</legend><p id="${scope}-help">${esc(c[kind==="interested"?"profileInterestedHelp":"profileNotInterestedHelp"])}</p><div class="reader-interest-options">${catalog.genres.map((interest,index)=>{const position=selected.indexOf(interest.id)+1;return `<label class="interest-option profile-interest-option"${interestColor(interest)}><input type="checkbox" data-${prefix}-interest="${kind}" value="${esc(interest.id)}" aria-labelledby="${scope}-name-${index}" aria-describedby="${scope}-help ${scope}-position-${index}" aria-disabled="${!position&&selected.length>=5}" ${position?"checked":""}><span class="interest-option-content">${interestIcon(interest)}<span class="interest-name" id="${scope}-name-${index}">${esc(interest.name[language])}</span></span><span class="profile-interest-mark profile-interest-mark--${kind}" aria-hidden="true">${position?(kind==="interested"?"✓":"×"):""}</span><span class="interest-order" aria-hidden="true">${position||""}</span><span class="sr-only interest-order-description" id="${scope}-position-${index}">${position?esc(c.profileInterestPosition(position)):""}</span></label>`;}).join("")}</div></fieldset>`;
}

export function syncReaderInterestSelector(root,selected,c) {
  for(const input of root.querySelectorAll('input[type="checkbox"]')) {
    const position=selected.indexOf(input.value)+1,option=input.closest(".interest-option"),kind=input.dataset.initialInterest||input.dataset.profileInterest;
    input.checked=position>0;
    input.setAttribute("aria-disabled",String(!position&&selected.length>=5));
    option.querySelector(".interest-order").textContent=position||"";
    option.querySelector(".interest-order-description").textContent=position?c.profileInterestPosition(position):"";
    option.querySelector(".profile-interest-mark").textContent=position?(kind==="interested"?"✓":"×"):"";
  }
}

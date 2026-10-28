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

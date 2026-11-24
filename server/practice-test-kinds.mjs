// Registry of Repaso test kinds. Each kind has its own definition table, the card field it hides and how it is
// assessed: "self" (the reader says whether they remembered: the client sends the outcome) or, in the future,
// "auto" (the server computes the outcome from the reader's choice). `practice_results.kind` has no CHECK: this
// registry is the only list of valid kinds.
export const PRACTICE_TEST_OUTCOMES=Object.freeze(["passed","failed"]);

export const PRACTICE_TEST_KINDS=Object.freeze({
  hideTitle:Object.freeze({table:"card_test_hide_title",field:"title",assessment:"self"}),
  hideContent:Object.freeze({table:"card_test_hide_content",field:"body",assessment:"self"})
});

export const isPracticeTestKind=kind=>typeof kind==="string"&&Object.hasOwn(PRACTICE_TEST_KINDS,kind);

const escapeRegExp=text=>text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const word="[\\p{L}\\p{M}\\p{N}_]";

// Every whole-word occurrence of `fragment` in `text`, case-insensitive and Unicode-aware ("Ética" matches
// "ética", never inside "éticamente"). Both sides are NFC-normalized.
export function fragmentOccurrences(text,fragment) {
  if(typeof text!=="string"||typeof fragment!=="string"||!fragment.trim()) return 0;
  const pattern=new RegExp(`(?<!${word})${escapeRegExp(fragment.normalize("NFC"))}(?!${word})`,"giu");
  return [...text.normalize("NFC").matchAll(pattern)].length;
}

// Fragments of one (card, language, kind) test that can be served against the card's current text, or null when
// the test cannot be served. `text` is the field of the kind (title for hideTitle, body for hideContent): a fragment
// is valid only when it occurs there, even if the client then hides it in all the visible text of the card (title,
// body and parent line).
// the test cannot be served. [] means the whole field. A definition that mixes the whole field with fragments is
// invalid; fragments that no longer occur in the text are dropped, and the test is dropped if none is left.
export function servableFragments(text,fragments) {
  if(typeof text!=="string"||!text.trim()||!Array.isArray(fragments)||!fragments.length) return null;
  if(fragments.includes("")) return fragments.length===1?[]:null;
  const present=[...new Set(fragments)].filter(fragment=>fragmentOccurrences(text,fragment)>0).sort();
  return present.length?present:null;
}

// Outcome of an answered test. Only "self" kinds exist for now: the client reports the outcome.
export function evaluatePracticeTest(kind,input) {
  const definition=PRACTICE_TEST_KINDS[kind];
  if(!definition||definition.assessment!=="self") return null;
  return PRACTICE_TEST_OUTCOMES.includes(input?.outcome)?input.outcome:null;
}

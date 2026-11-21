// Visitors (no session) in the new interface follow the old interface's policy: the Librería, the book page and the deck page
// (with its notes) are public; everything else, and every personal action, asks them to sign in first. Pure; index.mjs applies it.

// Is this route one a visitor may see? `where` comes from the router; `hasBook`/`hasDeck` look the id up in the catalog.
export function isPublicRoute(where,{hasBook,hasDeck}){
  if(where.name==="bookstore")return true;
  if(where.name==="book")return hasBook(where.id);
  // Reading cards, as the old interface's deck preview and shared card: an unknown card says so on its own screen.
  if(where.name==="cards")return hasDeck(where.id);
  if(where.name==="card")return true;
  return where.name==="deck"&&!where.note&&hasDeck(where.id);
}

// Personal actions that need a session, each with how Acceso opens for it: the mode and the reason shown (the old interface's own notices).
// A deck added to the Cardcase starts with sign-up, like the old interface; the others ask for no notice.
export const PERSONAL_ACTIONS={
  "add-deck":{mode:"register",notice:"accountLearningNotice"},
  "sort-interests":{mode:"login",notice:"interestSortSignInNotice"},
  "book-status":{mode:"login",notice:null},
  "catalog-book":{mode:"login",notice:null},
  "create-deck":{mode:"login",notice:null},
  "card-vote":{mode:"login",notice:null},
  "card-save":{mode:"login",notice:null}
};

// The `auth` fields for a visitor who asked for `intent` ({kind,…}, or null from the header's "Entrar") at `returnHash`.
// `mode` overrides the action's own one when the visitor chose it (Entrar or Crear cuenta of the card sign-in sheet).
export function accessRequest({intent=null,returnHash,mode=null}){
  const entry=PERSONAL_ACTIONS[intent?.kind]||{mode:"login",notice:null};
  return {mode:mode==="login"||mode==="register"?mode:entry.mode,notice:entry.notice,returnHash:returnHash&&returnHash!=="#account"?returnHash:"#home",intent};
}

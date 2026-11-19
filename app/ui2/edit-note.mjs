// «Editar nota» through POST /api/author/notes/edit: text, type and parent in one transaction. The server
// compares the base text sent here with what is saved (optimistic check) and answers 409 noteConflict
// when someone changed it meanwhile. The parent is sent only when it changed (it then goes last there).
export function editPayload(form){
  return {cardId:form.cardId,isQuote:form.isQuote,title:form.isQuote?"":form.title.trim(),body:form.body.trim(),baseTitle:form.baseTitle,baseBody:form.baseBody,
    ...((form.parentId??null)!==(form.baseParentId??null)?{parentId:form.parentId??null}:{})};
}

// Anything to save: text, type or parent differ from what the form started from.
export const editChanged=form=>form.title.trim()!==form.baseTitle.trim()&&!form.isQuote||form.body.trim()!==form.baseBody.trim()
  ||form.isQuote!==form.wasQuote||(form.parentId??null)!==(form.baseParentId??null);

// `refresh(form)` reloads the catalog and rebases the form on the saved text; the typed text is kept.
export async function submitEdit(api,form,refresh){
  try{return await api.request("/api/author/notes/edit",editPayload(form));}
  catch(failure){
    if(failure?.code==="noteConflict")await refresh(form);
    throw failure;
  }
}

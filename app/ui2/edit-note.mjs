// Correct a note through POST /api/author/notes/edit. The server compares the base text sent here with
// what is saved (optimistic check) and answers 409 noteConflict when someone changed it meanwhile.
export function editPayload(form){
  return {cardId:form.cardId,title:form.title.trim(),body:form.body.trim(),baseTitle:form.baseTitle,baseBody:form.baseBody};
}

// `refresh(form)` reloads the catalog and rebases the form on the saved text; the typed text is kept.
export async function submitEdit(api,form,refresh){
  try{return await api.request("/api/author/notes/edit",editPayload(form));}
  catch(failure){
    if(failure?.code==="noteConflict")await refresh(form);
    throw failure;
  }
}

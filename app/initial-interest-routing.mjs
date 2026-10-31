export function initialInterestRouteRedirect({userId,mode,preferencesUserId,preferences,hash}) {
  if(!userId||mode==="home"||mode==="account")return null;
  const known=preferencesUserId===userId&&!!preferences;
  if(known&&(preferences.configured||preferences.initialOpportunityClosed))return null;
  return {destination:hash,route:"#home"};
}

// Distinct local practice days per book. A missing threshold reserves a future stage.
export const mascotStages = Object.freeze([
  {id:"pot",name:"mascotNamePot",days:0},
  {id:"soil",name:"mascotNameSoil",days:1},
  {id:"seed",name:"mascotNameSeed",days:2},
  {id:"root",name:"mascotNameRoot",days:3},
  {id:"seedling",name:"mascotNameSeedling",days:4},
  {id:"sprout",name:"mascotNameSprout",days:5},
  {id:"stem",name:"mascotNameStem",days:10},
  {id:"bud",name:"mascotNameBud",days:12},
  {id:"flower",name:"mascotNameFlower",days:15},
  {id:"fruit",name:"mascotNameFruit"},
  {id:"infinity",name:"mascotNameInfinity"}
].map(Object.freeze));

export function mascotStageEarned(stage,{added=false,reviewDays=0}={}) {
  if (stage.days === undefined) return false;
  return stage.days === 0 ? added : reviewDays >= stage.days;
}

// A book contributes only its current stage to the profile inventory.
export function currentMascotStage(growth) {
  return mascotStages.findLast(stage=>mascotStageEarned(stage,growth))?.id ?? null;
}

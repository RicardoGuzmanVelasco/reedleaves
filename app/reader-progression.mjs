export const readerStages = Object.freeze([
  {id:"pot",name:"Maceta",icon:"container",firstLevel:1,lastLevel:2,surnames:["Vacía","Barnizada"]},
  {id:"soil",name:"Tierra",icon:"mountain",firstLevel:3,lastLevel:8,surnames:["Virgen","Húmeda","Fértil","Abonada","Nutrida","Viva"]},
  {id:"seed",name:"Semilla",icon:"circle-dot",firstLevel:9,lastLevel:12,surnames:["Dormida","Latente","Palpitante","Despierta"]},
  {id:"root",name:"Raíz",icon:"git-branch",firstLevel:13,lastLevel:16,surnames:["Tímida","Exploradora","Profunda I","Profunda II"]},
  {id:"seedling",name:"Germen",icon:"sprout",firstLevel:17,lastLevel:22,surnames:["Naciente","Incipiente","Emergente I","Emergente II","Vigoroso I","Vigoroso II"]},
  {id:"sprout",name:"Brote",icon:"leaf",firstLevel:23,lastLevel:31,surnames:["Tierno","Prometedor","Fresco I","Fresco II","Verde I","Verde II","Verde III","Resistente I","Resistente II"]},
  {id:"stem",name:"Tallo",icon:"trees",firstLevel:32,lastLevel:41,surnames:["Joven","Erguido","Firme I","Firme II","Robusto I","Robusto II","Inquebrantable I","Inquebrantable II","Imponente I","Imponente II"]},
  {id:"bud",name:"Capullo",icon:"flower",firstLevel:42,lastLevel:50,surnames:["Tímido","Protegido","Resguardado","Inquieto","Silvestre","Inmaduro","Maduro","Paciente","Impaciente"]},
  {id:"flower",name:"Flor",icon:"flower-2",firstLevel:51,lastLevel:59,surnames:["Naciente","Delicada","Colorida","Fragante","Radiante","Exuberante","Resplandeciente","Majestuosa","Espléndida"]},
  {id:"evergreen",name:"Siempreverde",icon:"infinity",firstLevel:60,lastLevel:Infinity,surnames:[]}
].map(stage=>Object.freeze({...stage,surnames:Object.freeze(stage.surnames)})));

export const readerXpMilestones = Object.freeze([[1,0],[3,110],[6,330],[9,660],[13,1100],[20,2200],[30,3300],[40,4400],[50,5500],[60,6600]].map(Object.freeze));

export function readerLevelXp(level) {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("Level must be a positive integer");
  if (level > 60) {
    const k=level-60;
    return 6600+110*k+5*k*(k+1)/2;
  }
  const i=readerXpMilestones.findIndex(([end])=>level<=end);
  const [startLevel,startXp]=readerXpMilestones[i-1]??readerXpMilestones[0];
  const [endLevel,endXp]=readerXpMilestones[i];
  if(level===startLevel) return startXp;
  return Math.round((startXp+(level-startLevel)*(endXp-startXp)/(endLevel-startLevel))/5)*5;
}

export function readerLevelForXp(xp) {
  if (typeof xp!=="number" || !Number.isFinite(xp) || xp<0) throw new RangeError("XP must be a non-negative finite number");
  let low=1,high=60;
  while(readerLevelXp(high)<=xp && high<1_000_000) high*=2;
  while(low<high) {
    const middle=Math.ceil((low+high)/2);
    if(readerLevelXp(middle)<=xp) low=middle; else high=middle-1;
  }
  return low;
}

export function readerLevel(level) {
  if(!Number.isInteger(level)||level<1) throw new RangeError("Level must be a positive integer");
  const stage=readerStages.find(item=>level>=item.firstLevel&&level<=item.lastLevel);
  const surname=stage===readerStages.at(-1)?toRoman(level-59):stage.surnames[level-stage.firstLevel];
  return Object.freeze({level,xp:readerLevelXp(level),stage:stage.id,stageName:stage.name,surname,fullName:`${stage.name} ${surname}`,icon:stage.icon});
}

export function readerProgressionForXp(xp) {
  const level=readerLevel(readerLevelForXp(xp));
  const nextLevelXp=readerLevelXp(level.level+1);
  return {...level,xp,xpIntoLevel:xp-level.xp,xpForNextLevel:nextLevelXp-level.xp,nextLevelXp};
}

function toRoman(value) {
  const pairs=[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let remaining=value,result="";
  for(const [n,symbol] of pairs) while(remaining>=n){result+=symbol;remaining-=n;}
  return result;
}

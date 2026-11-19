// Perfil (own or another reader's): who they are and how they are doing, read only.
// Base info and level bar, Intereses, Lecturas, Contribuciones and Crecimiento actual.
// Data: GET /api/profiles/:id and the interest preferences of that reader (both already in use by the old profile).
import {escapeHtml as esc,memberDate} from "../views.mjs";
import {mascotArt,mascotIcon} from "../mascot-art.mjs?v=tumbleweed";
import {mascotStages} from "../mascot-progress.mjs?v=evergreen-2";
import {readerLevelName} from "../reader-level-name.mjs";
import {interestIcon,interestColor} from "../interests.mjs";
import {icon} from "./icons.mjs";

const READINGS=[["book-read","booksRead"],["book-reading","booksReading"],["deck-view","cardsViewed"]];
const CONTRIBUTIONS=[["new-deck","decksCreated"],["take-note","cardsCreated"],["quote","quotesCreated"]];

// Pure. `profile`: body of GET /api/profiles/:id; `prefs`: {interested,notInterested} (ids); `interests`: the catalog's.
export function perfilData({profile,prefs,interests=[],viewerId,language}){
  const progression=profile.readerProgression||null,own=viewerId===profile.id;
  const chip=id=>{const interest=interests.find(item=>item.id===id);return interest?{id,name:interest.name?.[language]||id,markup:interestIcon(interest),color:interestColor(interest)}:null;};
  const list=ids=>(ids||[]).map(chip).filter(Boolean);
  const hasXp=own&&Number.isSafeInteger(progression?.xp)&&Number.isSafeInteger(progression.xpIntoLevel)&&Number.isSafeInteger(progression.xpForNextLevel)&&progression.xpForNextLevel>0;
  return {id:profile.id,own,name:profile.name,stage:progression?.stage||null,
    level:progression?{number:progression.level,name:readerLevelName(progression,language)}:null,
    xp:hasXp?{into:progression.xpIntoLevel,next:progression.xpForNextLevel}:null,
    joined:memberDate(profile.createdAt,language),
    interests:prefs?{yes:list(prefs.interested),no:list(prefs.notInterested)}:{yes:[],no:[]},
    readings:READINGS.map(([iconName,key])=>({icon:iconName,key,value:profile.counts[key]})),
    contributions:CONTRIBUTIONS.map(([iconName,key])=>({icon:iconName,key,value:profile.counts[key]})),
    growth:mascotStages.filter(stage=>stage.days!==undefined||profile.mascots[stage.id]>0).map(stage=>({id:stage.id,name:stage.name,count:profile.mascots[stage.id]??0}))};
}

// Two lines of text in every tile: the label breaks at the space that balances both halves.
export function twoLines(label){
  const spaces=[...label].flatMap((char,index)=>char===" "?[index]:[]);
  if(!spaces.length)return esc(label);
  const at=spaces.reduce((best,index)=>Math.abs(label.length/2-index)<Math.abs(label.length/2-best)?index:best);
  return `${esc(label.slice(0,at))}<br>${esc(label.slice(at+1))}`;
}

const number=(value,language)=>new Intl.NumberFormat(language).format(value);
const stats=(rows,tone,c,language)=>`<dl class="pf-stats">${rows.map(row=>`<div class="pf-stat pf-stat--${tone}"><span class="ui2-icon pf-stat-icon" data-icon="${row.icon}" aria-hidden="true"></span><dt>${twoLines(c[row.key])}</dt><dd>${number(row.value,language)}</dd></div>`).join("")}</dl>`;
const section=(title,inner,action="")=>`<section class="pf-section"><div class="pf-section-head"><h2>${esc(title)}</h2>${action}</div>${inner}</section>`;

function xpBar(data,c,language){
  if(!data.xp||!data.level)return "";
  const {into,next}=data.xp,fraction=`${number(into,language)} / ${number(next,language)}`;
  return `<div class="pf-xp"><div class="pf-bar xp-meter-art xp-meter-art--liston" role="progressbar" aria-label="${esc(c.readerLevelLabel(number(data.level.number+1,language)))}" aria-valuemin="0" aria-valuemax="${next}" aria-valuenow="${into}" aria-valuetext="${esc(c.readerXpFraction(number(into,language),number(next,language)))}" data-ratio="${into/next}">`
    +`<span class="level-up-medal pf-medal" role="img" aria-label="${esc(c.readerLevelLabel(number(data.level.number,language)))}"><span class="level-up-number">${number(data.level.number,language)}</span></span>`
    +`<span class="xp-liston-plank" aria-hidden="true"><span class="xp-liston-paint"></span><span class="xp-liston-ticks"></span></span></div><p class="pf-xp-fraction" aria-hidden="true">${fraction}</p></div>`;
}

function interestRows(data,c){
  const row=(kind,items,label)=>items.length?`<div class="pf-int-row"><span class="pf-mark pf-mark--${kind}" role="img" aria-label="${esc(label)}">${icon(kind==="yes"?"check":"close")}</span><ul class="pf-interests" role="list">${items.map(item=>`<li><span class="pf-chip"${item.color} role="img" aria-label="${esc(item.name)}">${item.markup}</span></li>`).join("")}</ul></div>`:"";
  const rows=row("yes",data.interests.yes,c.profileInterested)+row("no",data.interests.no,c.profileNotInterested);
  return rows?`<div class="pf-int-rows">${rows}</div>`:`<p class="pf-empty">${esc(c.profileInterestsEmpty)}</p>`;
}

const growthTiles=(data,c,language)=>`<ul class="pf-growth" aria-label="${esc(c.ui2ProfileGrowth)}">${data.growth.map(stage=>`<li class="pf-stat pf-stat--green pf-stage${stage.count?"":" is-zero"}">${mascotIcon(stage.id,"pf-stage-img")}<span class="pf-stage-name">${esc(c[stage.name])}</span><strong>${number(stage.count,language)}</strong></li>`).join("")}</ul>`;

// `legacy`: URL of the old interface, which still holds the other reader's Estantería.
export function perfilMarkup({data,c,language,legacy}){
  const gear=data.own?`<button type="button" class="ui2-btn secondary--subtle pf-gear" data-ui2="open-settings" aria-haspopup="dialog" aria-label="${esc(c.settings)}">${icon("settings")}</button>`:"";
  const shelf=data.own?"":`<a class="ui2-btn secondary--subtle pf-shelf" href="${esc(`${legacy}#library/${encodeURIComponent(data.id)}`)}">${icon("shelf")}<span>${esc(c.viewShelf)}</span></a>`;
  const editInterests=data.own?`<button type="button" class="ui2-btn secondary--subtle pf-edit" data-ui2="edit-interests" aria-haspopup="dialog" aria-label="${esc(c.edit)}">${icon("edit")}</button>`:"";
  return `<section class="pf-screen"><div class="pf-title"><button type="button" class="ui2-ib dp-back" data-ui2="page-back" aria-label="${esc(c.back)}">${icon("back")}</button><h1 tabindex="-1">${esc(c.profile)}</h1>${gear}</div>`
    +`<header class="pf-heading"><span class="pf-avatar" aria-hidden="true">${data.stage?mascotArt(data.stage):""}</span><div class="pf-identity"><h2 class="pf-name"><bdi>${esc(data.name)}</bdi></h2>`
    +(data.level?`<p class="pf-level">${esc(data.level.name)}</p>`:"")
    +`<p class="pf-date">${esc(c.memberSince)}<br><time datetime="${esc(data.joined.iso)}">${esc(data.joined.text)}</time></p></div>${xpBar(data,c,language)}</header>`
    +section(c.profileInterests,interestRows(data,c),editInterests)
    +section(c.ui2ProfileReadings,stats(data.readings,"green",c,language),shelf)
    +section(c.archivistSummary,stats(data.contributions,"blue",c,language))
    +section(c.ui2ProfileGrowth,growthTiles(data,c,language))+`</section>`;
}

// A reader that cannot be shown (unknown id). Connection and server errors never come here: they use the full-screen error.
export const perfilUnavailableMarkup=c=>`<section class="pf-screen"><div class="pf-title"><button type="button" class="ui2-ib dp-back" data-ui2="page-back" aria-label="${esc(c.back)}">${icon("back")}</button><h1 tabindex="-1">${esc(c.profile)}</h1></div><p class="pf-empty">${esc(c.profileUnavailable)}</p></section>`;

// The CSP forbids inline styles: the bar's fill goes through the CSSOM, as in xp-meter-art.mjs.
export function mountPerfil(root){
  for(const bar of root.querySelectorAll(".pf-bar[data-ratio]"))bar.style.setProperty("--p",String(Math.min(1,Math.max(0,Number(bar.dataset.ratio)||0))));
}

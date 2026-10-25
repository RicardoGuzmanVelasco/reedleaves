import React,{useEffect,useLayoutEffect,useOptimistic,useRef,useState,startTransition} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {contentText,contentLocale,quoteExcerpt} from './core.mjs';
import {words} from './i18n.mjs';
import {cardActionRecord,savedReferences,optimisticCardAction,createCardActionTransport} from './card-interactions.mjs';

function useRibbonPath(saved){
  const [extension,setExtension]=useState(saved?41:0),current=useRef(extension);
  useLayoutEffect(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)'),target=saved?41:0,from=current.current;
    let frame=null;
    const draw=value=>{current.current=value;setExtension(value)};
    const finish=()=>{if(frame!==null)window.cancelAnimationFrame(frame);frame=null;draw(target)};
    const onMotion=()=>{if(motion.matches)finish()};
    if(motion.matches||from===target)finish();
    else{
      const start=window.performance.now();
      const step=now=>{
        const progress=Math.min(1,(now-start)/620);
        // Keep the original cubic-bezier(.2,.9,.2,1) without CSS path support.
        let low=0,high=1;
        for(let i=0;i<16;i++){const t=(low+high)/2,x=.6*t-.6*t*t+t*t*t;if(x<progress)low=t;else high=t}
        const t=(low+high)/2,eased=2.7*t-2.4*t*t+.7*t*t*t;
        draw(progress===1?target:from+(target-from)*eased);
        frame=progress<1?window.requestAnimationFrame(step):null;
      };
      frame=window.requestAnimationFrame(step);
    }
    motion.addEventListener('change',onMotion);
    return ()=>{if(frame!==null)window.cancelAnimationFrame(frame);motion.removeEventListener('change',onMotion)};
  },[saved]);
  return `M0 11Q0 0 11 0h34q11 0 11 11v${61+extension}L28 ${56+extension} 0 ${72+extension}z`;
}
function Thumb(){return <><path d="M10 15h3l4-7 1-5c.2-2 2.6-2.3 4-.7 2.3 2.5 1.6 6.7-.4 10.7H28c3 0 4 2.1 3.2 4.8L28.7 28c-.6 2.1-2 3-4.3 3h-9.1c-2.2 0-3.8-1.1-5.3-3z"/><rect x="2" y="15" width="8" height="16" rx="2.3"/></>}
function Bookmark(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4Z"/></svg>}

export function CardActions({record,saved,c,onVote,onSave,error,onRetry,requiresAuth=false}){
  const ribbonPath=useRibbonPath(saved);
  const ready=record?.loaded===true,own=record?.isOwn===true;
  const total=value=>ready?String(value===1?record.likes??'':record.dislikes??''):'';
  return <div className="card-actions" data-vote={record?.vote||0} role="group" aria-label={c.cardActions}>
    <div className={'card-vote-controls'+(own?' is-own':'')} role="group" aria-label={c.cardFeedback}>
      <svg className="vote-plate" viewBox="0 0 112 74" aria-hidden="true"><g transform="translate(2 2) rotate(-2 54 32)">
        <rect className="action-plate-shadow" y="5" width="108" height="64" rx="21"/><rect className="action-plate-body" width="108" height="64" rx="21"/><path className="action-divider" d="M54 13v38"/>
        <g data-thumb="-1" transform="translate(14.9 21) scale(1.1) rotate(180 16.5 16.5)"><Thumb/></g><g data-thumb="1" transform="translate(56.8 6.7) scale(1.1)"><Thumb/></g>
        <text data-counter="-1" x="28" y="18">{total(-1)}</text><text data-counter="1" x="80" y="57">{total(1)}</text>
      </g></svg>
      {[-1,1].map(value=>{const count=total(value);return <button key={value} className="vote-target" type="button" data-card-action="vote" data-value={value} aria-label={`${value===1?c.likeCard:c.dislikeCard}${count?`, ${count}`:''}`} aria-pressed={record?.vote===value} disabled={(!ready&&!requiresAuth)||own} title={own?c.ownCardVotes:value===1?c.likeCard:c.dislikeCard} onClick={()=>onVote(value)}/>})}
      {own&&<span className="sr-only">{c.ownCardVotes}</span>}
    </div>
    <button className="save-target" type="button" data-card-action="save" aria-label={saved?c.unsaveCard:c.saveCard} aria-pressed={saved} title={saved?c.unsaveCard:c.saveCard} onClick={onSave}>
      <svg viewBox="0 0 64 124" aria-hidden="true"><g transform="translate(4 2)"><g className="ribbon-tilt"><path className="ribbon-shape ribbon-shadow" d={ribbonPath} transform="translate(0 5)"/><path className="ribbon-shape ribbon-body" d={ribbonPath}/><path className="ribbon-fold" d="M11 10h34"/><path data-plus d="M20 34h16m-8-8v16"/><path data-tick d="m19 34 6 6 13-14"/></g></g></svg>
    </button>
    {error&&<div className="card-action-error" role="status"><span>{c[error.code]||c.connectionError}</span><button type="button" onClick={onRetry}>{c.retry}</button></div>}
  </div>;
}

function GuestFeatures({context,api,callbacks}){
  const [record,setRecord]=useState(null);
  useEffect(()=>{let active=true;setRecord(null);api.request(`/api/cards/${encodeURIComponent(context.cardId)}/votes`).then(row=>{if(active)setRecord({...row,loaded:true})}).catch(()=>{if(active)setRecord({likes:null,dislikes:null,vote:null,isOwn:false,loaded:true})});return()=>{active=false}},[context.cardId]);
  const card=context.catalog.cardsById.get(context.cardId);
  if(!context.actionSlot||!card)return null;
  const askForVote=value=>callbacks.onAuthRequired({kind:'vote',value,cardId:card.id,deckId:card.deckId});
  const askForSave=()=>callbacks.onAuthRequired({kind:'save',cardId:card.id,deckId:card.deckId});
  return createPortal(<CardActions record={record||{likes:null,dislikes:null,vote:null,isOwn:false,loaded:false}} saved={false} c={words[context.language]} requiresAuth onVote={askForVote} onSave={askForSave} />,context.actionSlot);
}

export function SavedCardsEntry({count,c,onClick}){const hasSavedCards=count>0;return <button type="button" className="primary saved-cards-entry" onClick={onClick} aria-label={hasSavedCards?`${c.savedCards}, ${c.noteCardsCount(count)}`:c.savedCards}><Bookmark/><span>{c.savedCards}</span>{hasSavedCards&&<span aria-hidden="true">{count}</span>}</button>}
function SavedCards({rows,catalog,c,language,onOpen,error,onRetry,onReady}){
  useLayoutEffect(()=>{onReady()},[rows,onReady]);
  return <>{error&&<div className="sync-note" role="status"><span>{c[error]||c.connectionError}</span><button type="button" className="text-button" onClick={onRetry}>{c.retry}</button></div>}
    {!rows.length?<p className="empty-state">{c.noSavedCards}</p>:<ul className="saved-cards-list">{rows.map(row=>{
      const card=catalog.cardsById.get(row.cardId),deck=catalog.decksById.get(card.deckId);
      const cardLanguage=card.language||card.deckLanguage,isGuide=card.isReadingGuide;
      const title=isGuide?contentText(card.body,language,cardLanguage):card.isQuote?quoteExcerpt(contentText(card.body,language,cardLanguage)):contentText(card.title,language,cardLanguage);
      const guideLanguage=isGuide?new Intl.DisplayNames([language],{type:'language'}).of(cardLanguage)||cardLanguage:null;
      return <li key={card.id}><button type="button" className={'saved-card-row'+(card.isQuote?' saved-card-row--quote':'')+(isGuide?' saved-card-row--reading-guide':'')} data-card={card.id} onClick={()=>onOpen(card.id)}>
        <span className="saved-card-name" lang={contentLocale(isGuide||card.isQuote?card.body:card.title,language,cardLanguage)} dir="auto">{isGuide?'↗ ':card.isQuote?'❝ ':''}{title}</span><span className="saved-card-source" lang={contentLocale(deck.title,language,deck.language)} dir="auto">{contentText(deck.title,language,deck.language)}{isGuide?` · ${c.readingGuideLanguage}: ${guideLanguage}`:''}</span>
      </button></li>})}</ul>}
  </>;
}

function Features({context,api,callbacks}){
  const latestContext=useRef(context);latestContext.current=context;
  const alive=useRef(true);useEffect(()=>()=>{alive.current=false},[]);
  const [confirmed,setConfirmed]=useState(()=>({records:{},saves:savedReferences(context.cardSaves)}));
  const [optimistic,dispatch]=useOptimistic(confirmed,optimisticCardAction);
  const optimisticRef=useRef(optimistic);optimisticRef.current=optimistic;
  const [errors,setErrors]=useState({}),[collectionError,setCollectionError]=useState(null);
  const generations=useRef({}),latest=useRef({}),intent=useRef({});
  const transport=useRef(null);transport.current ||= createCardActionTransport(api,value=>callbacks.onPending(context.userId,value));
  const current=userId=>alive.current && latestContext.current.userId===userId;

  useEffect(()=>{setConfirmed(state=>({...state,saves:savedReferences(context.cardSaves)}))},[context.cardSaves]);
  function putRecord(cardId,row){startTransition(()=>setConfirmed(state=>({...state,records:{...state.records,[cardId]:{...state.records[cardId],...row,loaded:true}}})))}
  async function load(cardId){
    if(!cardId)return;const userId=context.userId,deck=(generations.current[cardId]||0)+1;generations.current[cardId]=deck;
    try{
      const row=await transport.current.read(userId,cardId);if(!current(userId)||generations.current[cardId]!==deck)return;
      putRecord(cardId,row);
      const bookId=context.catalog.cardsById.get(cardId)?.bookId;
      startTransition(()=>setConfirmed(state=>optimisticCardAction(state,{kind:'save',cardId,bookId,saved:row.saved,savedAt:row.savedAt})));
      callbacks.onSavedConfirm({...row,bookId},userId);setErrors(e=>({...e,[cardId+':read']:null}));
    }
    catch(error){if(current(userId)&&generations.current[cardId]===deck)setErrors(e=>({...e,[cardId+':read']:{code:error.code||'connectionError'}}))}
  }
  useEffect(()=>{if(!transport.current.pending)load(context.cardId)},[context.cardId,context.revision]);

  async function loadCollection(){
    const {userId,bookId}=context;const deck=(generations.current.collection||0)+1;generations.current.collection=deck;
    try{
      const result=await api.request(`/api/reader/saved/${encodeURIComponent(bookId)}`,undefined,{queueKey:`saved-read:${userId}:${bookId}`});
      if(!current(userId)||generations.current.collection!==deck)return;
      callbacks.onCollectionConfirm(result,userId);
      setConfirmed(state=>({...state,saves:{...Object.fromEntries(Object.entries(state.saves).filter(([,row])=>row.bookId!==bookId)),...savedReferences(result.cards)}}));setCollectionError(null);
    }catch(error){if(current(userId)&&generations.current.collection===deck)setCollectionError(error.code||'connectionError')}
  }
  useEffect(()=>{if(context.mode==='saved'&&!transport.current.pending)loadCollection()},[context.mode,context.bookId,context.revision]);

  function mutate(action){
    const userId=context.userId,key=action.cardId+':'+action.kind;
    const id=(latest.current[key]||0)+1;latest.current[key]=id;intent.current[key]=action;
    generations.current[action.cardId]=(generations.current[action.cardId]||0)+1;generations.current.collection=(generations.current.collection||0)+1;
    callbacks.onActionStart();setErrors(e=>({...e,[key]:null}));
    startTransition(async()=>{
      dispatch(action);
      try{
        const row=await transport.current.write(userId,action);if(!current(userId))return;
        generations.current[action.cardId]=(generations.current[action.cardId]||0)+1;
        if(action.kind==='vote')putRecord(action.cardId,row);
        else{
          startTransition(()=>setConfirmed(state=>optimisticCardAction(state,{kind:'save',cardId:row.cardId,bookId:row.bookId,saved:row.saved,savedAt:row.savedAt})));
          callbacks.onSavedConfirm(row,userId);
          if(!confirmed.records[action.cardId]?.loaded)load(action.cardId);
        }
      }catch(error){
        if(!current(userId))return;
        if(error.status===401){callbacks.onSessionExpired();return}
        // A lost response may hide a committed write. Read server state before rolling back.
        try{
          const recoveryGeneration=generations.current[action.cardId];
          const row=await transport.current.read(userId,action.cardId);if(!current(userId))return;
          if(generations.current[action.cardId]===recoveryGeneration){
            putRecord(action.cardId,row);
            startTransition(()=>setConfirmed(state=>optimisticCardAction(state,{kind:'save',cardId:action.cardId,bookId:action.bookId,saved:row.saved,savedAt:row.savedAt})));
            callbacks.onSavedConfirm({...row,bookId:action.bookId},userId);
          }
        }catch{/* The last confirmed state remains the rollback target. */}
        if(latest.current[key]===id)setErrors(e=>({...e,[key]:{code:error.code||'connectionError',action}}));
      }finally{if(latest.current[key]===id)delete intent.current[key]}
    });
  }
  function vote(value){const cardId=context.cardId,key=cardId+':vote',previous=intent.current[key]?.value ?? optimisticRef.current.records[cardId]?.vote;mutate({kind:'vote',cardId,bookId:context.bookId,value:previous===value?0:value})}
  function save(){const cardId=context.cardId,key=cardId+':save',previous=intent.current[key]?.saved ?? !!optimisticRef.current.saves[cardId];mutate({kind:'save',cardId,bookId:context.bookId,saved:!previous,savedAt:new Date().toISOString()})}
  const c=words[context.language];
  const rows=Object.values(optimistic.saves).filter(row=>row.bookId===context.bookId && context.catalog.cardsById.has(row.cardId)).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)||b.cardId.localeCompare(a.cardId));
  const card=context.catalog.cardsById.get(context.cardId);
  const record=cardActionRecord(optimistic.records[context.cardId],card,context.userId);
  const error=errors[context.cardId+':save']||errors[context.cardId+':vote']||errors[context.cardId+':read'];
  return <>
    {context.actionSlot&&card&&createPortal(<CardActions record={record} saved={!!optimistic.saves[card.id]} c={c} onVote={vote} onSave={save} error={error} onRetry={()=>error?.action?mutate(error.action):load(context.cardId)}/>,context.actionSlot)}
    {context.entrySlot&&createPortal(<SavedCardsEntry count={rows.length} c={c} onClick={()=>callbacks.onGoToSavedBook(context.bookId)}/>,context.entrySlot)}
    {context.listSlot&&createPortal(<SavedCards rows={context.quotesOnly?rows.filter(row=>context.catalog.cardsById.get(row.cardId).isQuote):rows} catalog={context.catalog} c={c} language={context.language} onOpen={callbacks.onOpenSavedCard} error={collectionError} onRetry={loadCollection} onReady={callbacks.onSavedListReady}/>,context.listSlot)}
  </>;
}

export function createCardFeaturesBridge({api,...callbacks}){
  const element=document.createElement('div');element.className='card-feature-root';document.body.append(element);const root=createRoot(element);
  let userId=null;const pending=new Map();
  return {get pending(){return [...pending.values()].some(row=>row.userId===userId&&row.value>0)},update(context){
    userId=context.userId;
    const slots=context.actionSlots?.length?context.actionSlots:[context.actionSlot];
    root.render(context.catalog?<>{slots.map((slot,index)=>{
      const cardId=slot?.dataset.cardActions||context.cardId;
      const local={...context,cardId,actionSlot:slot,entrySlot:index===0?context.entrySlot:null,listSlot:index===0?context.listSlot:null};
      const handlers={...callbacks,onPending:(id,value)=>{const key=id+':'+(cardId||'collection');if(value)pending.set(key,{userId:id,value});else pending.delete(key)}};
      return context.userId?<Features key={context.userId+':'+(cardId||'collection')} context={local} api={api} callbacks={handlers}/>:<GuestFeatures key={'guest:'+(cardId||'collection')} context={local} api={api} callbacks={handlers}/>;
    })}</>:null);
  },dispose(){root.unmount();element.remove()}};
}

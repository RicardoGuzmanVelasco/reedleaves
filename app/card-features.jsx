import React,{useEffect,useLayoutEffect,useOptimistic,useRef,useState,startTransition} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {contentText,contentLocale,quoteExcerpt} from './core.mjs';
import {words} from './i18n.mjs';
import {savedReferences,optimisticCardAction,createCardActionTransport} from './card-interactions.mjs';

const shortRibbon='M0 11Q0 0 11 0h34q11 0 11 11v61L28 56 0 72z';
function Thumb(){return <><path d="M10 15h3l4-7 1-5c.2-2 2.6-2.3 4-.7 2.3 2.5 1.6 6.7-.4 10.7H28c3 0 4 2.1 3.2 4.8L28.7 28c-.6 2.1-2 3-4.3 3h-9.1c-2.2 0-3.8-1.1-5.3-3z"/><rect x="2" y="15" width="8" height="16" rx="2.3"/></>}
function Bookmark(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4Z"/></svg>}

export function CardActions({record,saved,c,onVote,onSave,error,onRetry}){
  const ready=record?.loaded===true,own=record?.isOwn===true;
  const total=value=>ready?(value===1?record.likes:record.dislikes):'…';
  return <div className="card-actions" data-vote={record?.vote||0} role="group" aria-label={c.cardActions}>
    <div className={'card-vote-controls'+(own?' is-own':'')} role="group" aria-label={c.cardFeedback}>
      <svg className="vote-plate" viewBox="0 0 112 74" aria-hidden="true"><g transform="translate(2 2) rotate(-2 54 32)">
        <rect className="action-plate-shadow" y="5" width="108" height="64" rx="21"/><rect className="action-plate-body" width="108" height="64" rx="21"/><path className="action-divider" d="M54 13v38"/>
        <g data-thumb="-1" transform="translate(14.9 21) scale(1.1) rotate(180 16.5 16.5)"><Thumb/></g><g data-thumb="1" transform="translate(56.8 6.7) scale(1.1)"><Thumb/></g>
        <text data-counter="-1" x="28" y="18">{total(-1)}</text><text data-counter="1" x="80" y="57">{total(1)}</text>
      </g></svg>
      {[-1,1].map(value=><button key={value} className="vote-target" type="button" data-card-action="vote" data-value={value} aria-label={`${value===1?c.likeCard:c.dislikeCard}, ${total(value)}`} aria-pressed={record?.vote===value} disabled={!ready||own} title={own?c.ownCardVotes:value===1?c.likeCard:c.dislikeCard} onClick={()=>onVote(value)}/>)}
      {own&&<span className="sr-only">{c.ownCardVotes}</span>}
    </div>
    <button className="save-target" type="button" data-card-action="save" aria-label={saved?c.unsaveCard:c.saveCard} aria-pressed={saved} title={saved?c.unsaveCard:c.saveCard} onClick={onSave}>
      <svg viewBox="0 0 64 124" aria-hidden="true"><g transform="translate(4 2)"><g className="ribbon-tilt"><path className="ribbon-shape ribbon-shadow" d={shortRibbon} transform="translate(0 5)"/><path className="ribbon-shape ribbon-body" d={shortRibbon}/><path className="ribbon-fold" d="M11 10h34"/><path data-plus d="M20 34h16m-8-8v16"/><path data-tick d="m19 34 6 6 13-14"/></g></g></svg>
    </button>
    {error&&<div className="card-action-error" role="status"><span>{c[error.code]||c.connectionError}</span><button type="button" onClick={onRetry}>{c.retry}</button></div>}
  </div>;
}

function SavedCardsEntry({count,c,onClick}){return <button type="button" className="saved-cards-entry" onClick={onClick}><Bookmark/><span>{c.savedCards}</span><strong>{count}</strong></button>}
function SavedCards({rows,catalog,c,language,onOpen,error,onRetry,onReady}){
  useLayoutEffect(()=>{onReady()},[rows,onReady]);
  return <>{error&&<div className="sync-note" role="status"><span>{c[error]||c.connectionError}</span><button type="button" className="text-button" onClick={onRetry}>{c.retry}</button></div>}
    {!rows.length?<p className="empty-state">{c.noSavedCards}</p>:<ul className="saved-cards-list">{rows.map(row=>{
      const card=catalog.cardsById.get(row.cardId),version=catalog.versionsById.get(card.versionId);
      const title=card.isQuote?quoteExcerpt(contentText(card.body,language,card.deckLanguage)):contentText(card.title,language,card.deckLanguage);
      return <li key={card.id}><button type="button" className={'saved-card-row'+(card.isQuote?' saved-card-row--quote':'')} data-card={card.id} onClick={()=>onOpen(card.id)}>
        <span className="saved-card-name" lang={contentLocale(card.isQuote?card.body:card.title,language,card.deckLanguage)} dir="auto">{card.isQuote?'❝ ':''}{title}</span><span className="saved-card-source" lang={contentLocale(version.title,language,version.language)} dir="auto">{contentText(version.title,language,version.language)}</span>
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
  const versions=useRef({}),latest=useRef({}),intent=useRef({});
  const transport=useRef(null);transport.current ||= createCardActionTransport(api,value=>callbacks.onPending(context.userId,value));
  const current=userId=>alive.current && latestContext.current.userId===userId;

  useEffect(()=>{setConfirmed(state=>({...state,saves:savedReferences(context.cardSaves)}))},[context.cardSaves]);
  function putRecord(cardId,row){startTransition(()=>setConfirmed(state=>({...state,records:{...state.records,[cardId]:{...state.records[cardId],...row,loaded:true}}})))}
  async function load(cardId){
    if(!cardId)return;const userId=context.userId,version=(versions.current[cardId]||0)+1;versions.current[cardId]=version;
    try{
      const row=await transport.current.read(userId,cardId);if(!current(userId)||versions.current[cardId]!==version)return;
      putRecord(cardId,row);
      const bookId=context.catalog.cardsById.get(cardId)?.bookId;
      startTransition(()=>setConfirmed(state=>optimisticCardAction(state,{kind:'save',cardId,bookId,saved:row.saved,savedAt:row.savedAt})));
      callbacks.onSavedConfirm({...row,bookId},userId);setErrors(e=>({...e,[cardId+':read']:null}));
    }
    catch(error){if(current(userId)&&versions.current[cardId]===version)setErrors(e=>({...e,[cardId+':read']:{code:error.code||'connectionError'}}))}
  }
  useEffect(()=>{if(!transport.current.pending)load(context.cardId)},[context.cardId,context.revision]);

  async function loadCollection(){
    const {userId,bookId}=context;const version=(versions.current.collection||0)+1;versions.current.collection=version;
    try{
      const result=await api.request(`/api/reader/saved/${encodeURIComponent(bookId)}`,undefined,{queueKey:`saved-read:${userId}:${bookId}`});
      if(!current(userId)||versions.current.collection!==version)return;
      callbacks.onCollectionConfirm(result,userId);
      setConfirmed(state=>({...state,saves:{...Object.fromEntries(Object.entries(state.saves).filter(([,row])=>row.bookId!==bookId)),...savedReferences(result.cards)}}));setCollectionError(null);
    }catch(error){if(current(userId)&&versions.current.collection===version)setCollectionError(error.code||'connectionError')}
  }
  useEffect(()=>{if(context.mode==='saved'&&!transport.current.pending)loadCollection()},[context.mode,context.bookId,context.revision]);

  function mutate(action){
    const userId=context.userId,key=action.cardId+':'+action.kind;
    const id=(latest.current[key]||0)+1;latest.current[key]=id;intent.current[key]=action;
    versions.current[action.cardId]=(versions.current[action.cardId]||0)+1;versions.current.collection=(versions.current.collection||0)+1;
    callbacks.onActionStart();setErrors(e=>({...e,[key]:null}));
    startTransition(async()=>{
      dispatch(action);
      try{
        const row=await transport.current.write(userId,action);if(!current(userId))return;
        versions.current[action.cardId]=(versions.current[action.cardId]||0)+1;
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
          const recoveryVersion=versions.current[action.cardId];
          const row=await transport.current.read(userId,action.cardId);if(!current(userId))return;
          if(versions.current[action.cardId]===recoveryVersion){
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
  const card=context.catalog.cardsById.get(context.cardId),deck=context.catalog.decksById.get(card?.deckId);
  const record={...optimistic.records[context.cardId],isOwn:deck?.creator.userId===context.userId};
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
  const handlers={...callbacks,onPending:(id,value)=>{if(value)pending.set(id,value);else pending.delete(id)}};
  return {get pending(){return (pending.get(userId)||0)>0},update(context){userId=context.userId;root.render(context.userId&&context.catalog?<Features key={context.userId} context={context} api={api} callbacks={handlers}/>:null)},dispose(){root.unmount();element.remove()}};
}

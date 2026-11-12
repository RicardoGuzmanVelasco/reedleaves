import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';

// Exercise the real button and Features handler, with a controlled React lifecycle.
const entry=new URL('./card-features.jsx',import.meta.url).pathname;
const {outputFiles}=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',plugins:[{
  name:'controlled-react',setup(builder){
    builder.onLoad({filter:/card-features\.jsx$/},async()=>({contents:(await readFile(entry,'utf8')).replace('function Features({context,api,callbacks})','export function Features({context,api,callbacks})'),loader:'jsx',resolveDir:new URL('.',import.meta.url).pathname}));
    builder.onResolve({filter:/^react$/},()=>({path:'react',namespace:'test'}));
    builder.onResolve({filter:/^react-dom$/},()=>({path:'react-dom',namespace:'test'}));
    builder.onResolve({filter:/^react-dom\/client$/},()=>({path:'client',namespace:'test'}));
    builder.onResolve({filter:/^react\/jsx-runtime$/},({path})=>({path:import.meta.resolve(path),external:true}));
    builder.onLoad({filter:/.*/,namespace:'test'},({path})=>({contents:path==='react'?`export const useEffect=()=>{}, useLayoutEffect=()=>{}, useMemo=fn=>fn(), useRef=value=>({current:value}), useState=value=>[typeof value==='function'?value():value,()=>{}], useOptimistic=value=>[value,()=>{}], startTransition=fn=>fn(); export default {};`:path==='react-dom'?'export const createPortal=child=>child;':'export const createRoot=()=>({});',loader:'js'}));
  }
}]});
const {Features,CardActions}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

for(const alreadySaved of [false,true]) test(`clicking the bookmark ${alreadySaved?'removes':'saves'} the displayed card`,async()=>{
  const requests=[],commits=[], card={id:'card-1',bookId:'book-1',deckId:'deck-1'};
  const context={userId:'reader',cardId:card.id,bookId:card.bookId,cardSaves:alreadySaved?[{cardId:card.id,bookId:card.bookId,savedAt:'2026-01-01T00:00:00Z'}]:[],language:'en',actionSlot:{},catalog:{cardsById:new Map([[card.id,card]])}};
  const api={request:async(path,body)=>{requests.push({path,body});return {...body,bookId:card.bookId,savedAt:'2026-01-01T00:00:00Z'}}};
  const callbacks={onPending(){},onActionStart(){},onCardSaveWarning(){},onSavedConfirm(row){commits.push(row)}};
  const portal=Features({context,api,callbacks}).props.children[0];
  const actions=CardActions(portal.props);
  const button=actions.props.children.find(child=>child?.props?.['data-card-action']==='save');
  button.props.onClick({type:'click'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requests[0],{path:'/api/cards/save',body:{cardId:'card-1',saved:!alreadySaved}});
  assert.equal(commits[0]?.saved,!alreadySaved);
});

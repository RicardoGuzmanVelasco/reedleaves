import test from 'node:test';
import assert from 'node:assert/strict';
import {sortDecks} from './decks.mjs';
import {defaultNoteDeckTitle} from './note-defaults.mjs';
import {emptyCatalog} from '../test-support/reader-state.mjs';

function scenario(rows){
  const catalog=emptyCatalog();
  for(const row of rows){
    const {id,title,language='es',cards=[],...other}=row;
    const deck={id,language,title:{[language]:title},creator:{userId:'viewer'},...other};
    catalog.decks.push(deck);
    catalog.deckModels.set(id,{cards});
  }
  return catalog;
}

test('Deck priorities apply lexicographically and use card authorship, including reading guides',()=>{
  const catalog=scenario([
    {id:'automatic',title:defaultNoteDeckTitle('es')},
    {id:'generic',title:'Mis notas personales'},
    {id:'specific',title:'Hábitos esenciales'},
    {id:'own-automatic',title:defaultNoteDeckTitle('en'),language:'en',cards:[{creatorUserId:'viewer'}]},
    {id:'recommended',title:'Notas del equipo',isRecommended:true},
    {id:'guides',title:'Guías de lectura',cards:[{creatorUserId:'other',isReadingGuide:true}]},
    {id:'recommended-own',title:defaultNoteDeckTitle('es'),isRecommended:true,cards:[{creatorUserId:'viewer'}]}
  ]);
  const original=[...catalog.decks];
  assert.deepEqual(sortDecks(catalog,catalog.decks,{userId:'viewer'}).map(deck=>deck.id),[
    'recommended-own','guides','recommended','own-automatic','specific','generic','automatic'
  ]);
  assert.deepEqual(catalog.decks,original);
  assert.deepEqual(sortDecks(catalog,catalog.decks).map(deck=>deck.id),[
    'guides','recommended','recommended-own','specific','generic','automatic','own-automatic'
  ]);
});

test('Automatic titles reuse the language defaults and generic words match whole words in both languages',()=>{
  for(const language of ['es','en']){
    const catalog=scenario([
      {id:'auto',title:defaultNoteDeckTitle(language),language},
      {id:'generic',title:language==='es'?'NOTAS PERSONALES':'Personal notes',language},
      {id:'specific',title:language==='es'?'Personalidad y anotaciones':'Personality and noteworthy ideas',language},
      {id:'tie',title:language==='es'?'Decisiones':'Decisions',language}
    ]);
    assert.deepEqual(sortDecks(catalog,catalog.decks,{language}).map(deck=>deck.id),['specific','tie','generic','auto']);
  }
});

test('A card contribution wins over deck ownership and follows the current viewer',()=>{
  const catalog=scenario([
    {id:'creator-only',title:'Primera',cards:[{creatorUserId:'other'}]},
    {id:'contributed',title:'Segunda',creator:{userId:'other'},cards:[{creatorUserId:'viewer'}]}
  ]);
  assert.equal(sortDecks(catalog,catalog.decks,{userId:'viewer'})[0].id,'contributed');
  assert.equal(sortDecks(catalog,catalog.decks,{userId:'other'})[0].id,'creator-only');
});

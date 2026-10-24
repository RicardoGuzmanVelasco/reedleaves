// Dedicated disposable SQLite catalog. Never connects to a remote database.
import {resolve} from 'node:path';
import {openDatabase,initializeDatabase} from '../server/database.mjs';
import {readSeed,seedCatalog} from '../server/seed.mjs';
import {checkCatalog} from '../server/catalog-repository.mjs';
if(process.env.NODE_ENV==='production'||process.env.DATABASE_URL)throw new Error('Local demo requires a development environment without DATABASE_URL');
const path=resolve('var/bookshelf-demo.sqlite');
const db=openDatabase(path);
try{
  await initializeDatabase(db);
  const seed=readSeed(),originals=[...seed.books],links=[...seed.links],decks=[...seed.decks],cards=[...seed.cards];
  // Deliberately mixed short/long titles and both languages for fitting/ellipsis.
  for(let index=0;index<72;index++){
    const original=originals[index%originals.length],id=`local-spine-${index+1}`;
    seed.books.push({...original,id,position:String(originals.length+index+1),popular_title:original.popular_title+` · ${index+1}`,title_es:original.title_es?original.title_es+` · ${index+1}`:'',title_en:original.title_en?original.title_en+` · ${index+1}`:''});
    for(const deck of decks.filter(deck=>deck.book_id===original.id)){
      const deckId=id+'-'+deck.id;
      seed.decks.push({...deck,id:deckId,book_id:id});
      for(const card of cards.filter(card=>card.deck_id===deck.id))seed.cards.push({...card,id:id+'-'+card.id,book_id:id,deck_id:deckId,parent_id:card.parent_id?id+'-'+card.parent_id:''});
    }
    seed.links.push(...links.filter(link=>link.book_id===original.id).map(link=>({...link,book_id:id})));
  }
  await seedCatalog(db,seed);
  console.log({path,...await checkCatalog(db)});
}finally{await db.close();}

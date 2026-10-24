import test from 'node:test';
import assert from 'node:assert/strict';
import {deckPageHash,deckReadingHash,deckShareUrl} from './deck-navigation.mjs';
import {reviewView,deckPeekView,deckView} from './views.mjs';
import {words} from './i18n.mjs';
import {openDatabase,initializeDatabase} from '../server/database.mjs';
import {seedCatalog} from '../server/seed.mjs';
import {readCatalog} from '../server/catalog-repository.mjs';
import {prepareCatalog} from './catalog.mjs';
import {readerState} from '../test-support/reader-state.mjs';

test('Shared decks open clean reading without carrying the selected card',()=>{
  const url=deckShareUrl('https://reedleaves.com/app/#review/old/card-2','a-deck');
  assert.equal(url,'https://reedleaves.com/app/#preview/a-deck');
  assert.equal(deckPageHash('a/deck'),'#review/a%2Fdeck');
  assert.equal(deckReadingHash('a/deck'),'#preview/a%2Fdeck');
});

test('One deck page handles discovery, collection and ownership while clean reading keeps only cards',async()=>{
  const db=openDatabase(':memory:');let catalog;
  try{await initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db));}finally{await db.close();}
  const deck=catalog.decks[0],model=catalog.deckModels.get(deck.id);
  for(const language of ['es','en']){
    const c=words[language],base=readerState(catalog,{language,deckId:deck.id,bookId:deck.bookId,deckChoices:[{deck,tags:[]}]});
    assert.doesNotMatch(deckView({...base,openDeckId:deck.id}),/<dialog/);
    for(const userId of [undefined,'visitor',deck.creator.userId]){
      const state={...base,userId},page=reviewView(state);
      assert.ok(page.includes(c.readDeckCards));assert.match(page,/data-action="preview-deck"/);
      assert.match(page,/data-action="share-deck"/);assert.ok(page.includes(c.deckInformation));
      assert.equal(page.includes('data-action="add-deck-to-collection"'),userId!==deck.creator.userId);
      assert.equal(page.includes('data-action="take-deck-note"'),userId===deck.creator.userId&&deck.status==='draft');
    }
    const collected=reviewView({...base,userId:'visitor',enrolledIds:[deck.id]});
    assert.doesNotMatch(collected,/data-action="add-deck-to-collection"/);assert.ok(collected.includes(c.deckInCollection));
    const reading=deckPeekView(base);
    assert.ok(reading.includes(c.viewDeck));assert.match(reading,/data-action="back-from-deck-preview"/);
    assert.equal((reading.match(/<li>/g)||[]).length,model.cards.length);
    assert.doesNotMatch(reading,/class="deck-facts"|class="deck-description"|class="deck-creator"|data-action="add-deck-to-collection"|data-action="share-deck"/);
  }
});

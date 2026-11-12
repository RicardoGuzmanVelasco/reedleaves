import test from 'node:test';
import assert from 'node:assert/strict';
import {deckPageHash,deckReadingHash,deckShareUrl,cardShareUrl} from './deck-navigation.mjs';
import {deckPageView,deckPeekView,deckView,sharedCardView} from './views.mjs';
import {words} from './i18n.mjs';
import {openDatabase,initializeDatabase} from '../server/database.mjs';
import {seedCatalog} from '../server/seed.mjs';
import {readCatalog} from '../server/catalog-repository.mjs';
import {prepareCatalog} from './catalog.mjs';
import {readerState} from '../test-support/reader-state.mjs';

test('Shared decks open clean reading without carrying the selected card',()=>{
  const url=deckShareUrl('https://reedleaves.com/app/#deck/old/card-2','a-deck');
  assert.equal(url,'https://reedleaves.com/app/#preview/a-deck');
  assert.equal(deckPageHash('a/deck'),'#deck/a%2Fdeck');
  assert.equal(deckReadingHash('a/deck'),'#preview/a%2Fdeck');
  assert.equal(deckShareUrl('https://reedleaves.com/app/?sharedCard=old&cardLanguage=es#card/old/es','new'),'https://reedleaves.com/app/#preview/new');
  for(const language of ['es','en']) for(const type of ['idea','quote','card']) {
    const message=words[language].cardShareText(type,'Libro');
    assert.ok(message.includes('Libro'));
    assert.ok(message.includes(language==='es'?({idea:'idea',quote:'cita',card:'tarjeta'}[type]):type));
  }
});

test('One deck page handles discovery, collection and ownership while clean reading keeps only cards',async()=>{
  const db=openDatabase(':memory:');let catalog;
  try{await initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db));}finally{await db.close();}
  const deck=catalog.decks[0],model=catalog.deckModels.get(deck.id);
  for(const language of ['es','en']){
    const c=words[language],base=readerState(catalog,{language,deckId:deck.id,bookId:deck.bookId,deckChoices:[{deck,tags:[]}]});
    assert.equal(c.addDeckToCardcase,language==='es'?'Añadir al tarjetero':'Add to cardcase');
    assert.equal(c.removeDeckFromCardcase,language==='es'?'Quitar del tarjetero':'Remove from cardcase');
    assert.doesNotMatch(deckView({...base,openDeckId:deck.id}),/<dialog/);
    for(const userId of [undefined,'visitor',deck.creator.userId]){
      const state={...base,userId},page=deckPageView(state);
      assert.ok(page.includes(c.readDeckCards));assert.match(page,/data-action="preview-deck"/);
      assert.match(page,/data-action="share-deck"/);assert.ok(page.includes(c.deckInformation));
      assert.equal(page.includes('data-action="add-deck-to-cardcase"'),true);
      assert.equal(page.includes('data-action="take-deck-note"'),userId===deck.creator.userId&&deck.status==='draft');
    }
    const collected=deckPageView({...base,userId:'visitor',cardcaseDeckIds:[deck.id]});
    assert.doesNotMatch(collected,/data-action="add-deck-to-cardcase"/);assert.match(collected,/data-action="remove-cardcase-deck"/);assert.ok(collected.includes(c.removeDeckFromCardcase));
    const reading=deckPeekView(base);
    assert.ok(reading.includes(c.viewDeck));assert.match(reading,/data-action="back-from-deck-preview"/);
    assert.equal((reading.match(/<li>/g)||[]).length,model.cards.length);
    assert.equal((reading.match(/data-card-actions=/g)||[]).length,model.cards.length);
    const carousel=deckPeekView({...base,presentationLayout:'carousel',presentationIndex:1});
    assert.match(carousel,/data-deck-presentation="carousel" data-index="1"/);
    assert.equal((carousel.match(/data-reading-card=/g)||[]).length,1);
    assert.equal((carousel.match(/data-card-actions=/g)||[]).length,1);
    assert.equal((carousel.match(/data-action="presentation-card"/g)||[]).length,model.cards.length);
    assert.match(carousel,/data-action="presentation-step"/);
    assert.ok(carousel.includes(c.closePresentation));
    assert.doesNotMatch(carousel,/class="deck-facts"|data-action="share-deck"|data-action="add-deck-to-cardcase"/);
    assert.doesNotMatch(reading,/class="deck-facts"|class="deck-description"|class="deck-creator"|data-action="add-deck-to-cardcase"|data-action="share-deck"/);
  }
});


test('A shared card retains its content language and shows only the requested card',async()=>{
  const db=openDatabase(':memory:');let catalog;
  try{await initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db));}finally{await db.close();}
  const card=catalog.cards[0],deck=catalog.decksById.get(card.deckId);
  const url=cardShareUrl('https://reedleaves.com/app/#daily-idea','card/one','es');
  assert.equal(url,'https://reedleaves.com/app/?sharedCard=card%2Fone&cardLanguage=es#card/card%2Fone/es');
  card.body={...card.body,es:'Texto compartido',en:'Shared text'};
  const state=readerState(catalog,{language:'en',sharedContentLanguage:'es',requestedId:card.id});
  const html=sharedCardView(state);
  assert.match(html,new RegExp(`data-reading-card="${card.id}"`));
  assert.ok(html.includes("Texto compartido"));
  assert.doesNotMatch(html,/Shared text/);
  assert.ok(html.includes(catalog.booksById.get(card.bookId).author));
  assert.ok(html.includes(deck.title.en || deck.title[deck.language]));
  const authorHref=`#bookstore/author/${encodeURIComponent(catalog.booksById.get(card.bookId).author)}`;
  const deckHref=deckPageHash(deck.id), creatorHref=`#profile/${encodeURIComponent(deck.creator.userId)}`;
  assert.ok(html.indexOf(authorHref)<html.indexOf(deckHref));
  assert.ok(html.indexOf(deckHref)<html.indexOf(creatorHref));
  assert.ok(html.includes(`href="${deckHref}"`));
  assert.doesNotMatch(html,/data-action="share-deck"|data-action="preview-deck"/);
  assert.match(sharedCardView({...state,requestedId:'missing'}),/no longer available/);
  card.isReadingGuide=true;
  assert.ok(sharedCardView(state).includes(`href="#guides/${encodeURIComponent(card.bookId)}"`));
  card.isReadingGuide=false;
  for(const language of ['es','en']) {
    const reading=deckPeekView({...state,language,deckId:deck.id,bookId:deck.bookId});
    const button=reading.match(/<button[^>]*data-action="share-card"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(button);
    assert.ok(button.includes(`aria-label="${words[language].shareDeck}"`));
    assert.doesNotMatch(button,/<span/);
  }
});

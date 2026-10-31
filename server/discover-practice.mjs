import {prepareCatalog} from "../app/catalog.mjs";
import {effectiveCardLanguage} from "../app/core.mjs";
import {selectDiscoverPracticeCards} from "../app/discover-practice.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {distinguishedBookIds} from "./book-reading.mjs";
import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {readerInterestPreferencesInside} from "./reader-interest-preferences.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";
import {readerLanguagePreferencesInside} from "./reader-language-preferences.mjs";
import {reviewableDeckIds} from "./review-card-access.mjs";

export const DISCOVER_PRACTICE_REQUIRED=5;

export async function discoverPracticeCandidateContext(db,userId,languages) {
  const catalog=prepareCatalog(await readCatalog(db,userId));
  const [access,preferences,languagePreferences,distinguished,statusRows]=await Promise.all([
    reviewableDeckIds(db,userId),
    readerInterestPreferencesInside(db,userId),
    readerLanguagePreferencesInside(db,userId),
    distinguishedBookIds(db,userId),
    db.prepare("SELECT book_id FROM book_reading WHERE user_id=?").all(userId)
  ]);
  const allowedLanguages=languages||languagePreferences.languages;
  const eligibleCards=catalog.allCards.filter(card=>!card.isReadingGuide&&access.has(card.deckId)&&
    allowedLanguages.includes(effectiveCardLanguage(card)));
  const shelfBookIds=new Set([...distinguished,...statusRows.map(row=>row.book_id)]);
  return {cards:eligibleCards,books:catalog.booksById,preferences,shelfBookIds};
}

export async function selectDiscoverPracticeForReader(db,userId,{languages,answers={},count=DISCOVER_PRACTICE_REQUIRED,random=Math.random,excludeCardIds=[]}={}) {
  const context=await discoverPracticeCandidateContext(db,userId,languages);
  const excluded=new Set(excludeCardIds);
  return selectDiscoverPracticeCards(context.cards.filter(card=>!excluded.has(card.id)),context.books,context.preferences,context.shelfBookIds,answers,count,random);
}

export async function readDiscoverPracticeAvailability(db,session) {
  if(!session?.user_id) throw new ApiError(401,"signInRequired");
  return transaction(db,async()=>{
    await lockReaderAccount(db,session.user_id);
    const result=await selectDiscoverPracticeForReader(db,session.user_id,{count:0});
    return {available:result.available,required:DISCOVER_PRACTICE_REQUIRED};
  });
}

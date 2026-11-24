// Weight of a card in the card selection of future Repaso sessions, from the reader's test results. Pure and
// isolated: a card whose latest test result (any kind) is "failed" is FAILED_TEST_CARD_WEIGHT times as likely to be
// drawn; "passed" does not weigh. Returns {cardId: weight} only for weighted cards (the rest weigh 1).
export const FAILED_TEST_CARD_WEIGHT=2;

export function practiceCardWeights(results=[]) {
  const latest=new Map();
  for(const result of results) {
    const order=`${result.localDay||""}\0${result.answeredAt||""}`,previous=latest.get(result.cardId);
    if(!previous||order>previous.order) latest.set(result.cardId,{order,outcome:result.outcome});
  }
  return Object.fromEntries([...latest].filter(([,last])=>last.outcome==="failed").map(([cardId])=>[cardId,FAILED_TEST_CARD_WEIGHT]));
}

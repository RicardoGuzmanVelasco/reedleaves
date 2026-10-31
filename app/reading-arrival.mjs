// Keep the reading backdrop and card entrance independent from card contents.
export function createReadingArrival({document: doc = document} = {}) {
  let previousKey = null, previousWasExclusive = false;

  return function present(main, {arrival = true} = {}) {
    const stage = main.querySelector(".exclusive-card-modal [data-reading-card]") || main.querySelector("[data-reading-card]");
    doc.body.classList.toggle("is-reading", !!stage);
    if (!stage) {
      previousKey = null;
      previousWasExclusive = false;
      return;
    }

    const body = stage.querySelector(".idea-body");
    const key = JSON.stringify([stage.dataset.readingCard, stage.querySelector("#idea-content")?.textContent, body?.textContent, body?.lang]);
    const isExclusive = !!stage.closest?.(".exclusive-card-modal");
    const fresh = key !== previousKey || isExclusive && !previousWasExclusive;
    previousKey = key;
    previousWasExclusive = isExclusive;
    if (fresh && arrival) stage.classList.add("is-arriving");
  };
}

// Progressive enhancement: the HTML always contains the complete, readable card.
export function createReadingPresentation({window: win = window, document: doc = document} = {}) {
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
  let previousKey = null, previousWasExclusive = false, dispose = () => {};

  return function present(main) {
    dispose();
    const stage = main.querySelector(".exclusive-card-modal [data-reading-card]") || main.querySelector("[data-reading-card]");
    doc.body.classList.toggle("is-reading", !!stage);
    if (!stage) { previousKey = null; previousWasExclusive = false; return; }
    const body = stage.querySelector(".idea-body");
    const text = body.textContent;
    const key = JSON.stringify([stage.dataset.readingCard, stage.querySelector("#idea-content")?.textContent, text, body.lang]);
    const isExclusive = !!stage.closest?.(".exclusive-card-modal");
    const fresh = key !== previousKey || isExclusive && !previousWasExclusive;
    previousKey = key; previousWasExclusive = isExclusive;
    if (!fresh || motion.matches || doc.hidden || !text) { dispose = () => {}; return; }

    stage.classList.add("is-arriving");
    if (stage.dataset.readingMode === "complete") { dispose = () => {}; return; }
    // Reserve the final layout and expose the full text once to assistive technology.
    const full = doc.createElement("span"), space = doc.createElement("span"), ink = doc.createElement("span");
    full.className = "sr-only"; full.textContent = text;
    space.className = "typewriter-space"; space.textContent = text; space.setAttribute("aria-hidden", "true");
    ink.className = "typewriter-ink"; ink.setAttribute("aria-hidden", "true");
    body.replaceChildren(full, space, ink);
    const characters = typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter(body.lang || undefined, {granularity:"grapheme"}).segment(text)].map(part => part.segment) : Array.from(text);
    // Reveal punctuation immediately, then pause long enough to let the sentence land.
    // Keep long cards readable without letting the effect run indefinitely.
    let total = 0;
    const timeline = characters.map((character,index) => {
      total += 18;
      const at = total;
      if (index < characters.length - 1) {
        total += /[.!?:\r\n\u2028\u2029]/u.test(character) ? 520 : /[,;\-\u2010-\u2015]/u.test(character) ? 220 : 0;
      }
      return at;
    });
    const scale = Math.min(1,6000 / total);
    const duration = total * scale;
    let frame = 0, start = null, finished = false, count = 0;

    function finish() {
      if (finished) return;
      finished = true;
      win.cancelAnimationFrame(frame);
      body.replaceChildren(doc.createTextNode(text));
    }
    function reveal(now) {
      start ??= now;
      const elapsed = Math.max(0, now - start - 180);
      let next = count;
      while (next < characters.length && timeline[next] * scale <= elapsed) next++;
      if (next !== count) { count = next; ink.textContent = characters.slice(0, count).join(""); }
      if (elapsed >= duration) finish();
      else frame = win.requestAnimationFrame(reveal);
    }
    function reduceMotion() { if (motion.matches) finish(); }
    function hide() { if (doc.hidden) finish(); }
    motion.addEventListener("change", reduceMotion);
    doc.addEventListener("visibilitychange", hide);
    frame = win.requestAnimationFrame(reveal);
    dispose = () => {
      finish();
      motion.removeEventListener("change", reduceMotion);
      doc.removeEventListener("visibilitychange", hide);
    };
  };
}

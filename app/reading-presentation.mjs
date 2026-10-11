// Progressive enhancement: the HTML always contains the complete, readable card.
export function createReadingPresentation({window: win = window, document: doc = document} = {}) {
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
  let previousKey = null, dispose = () => {};

  return function present(main) {
    dispose();
    const stage = main.querySelector("[data-reading-card]");
    doc.body.classList.toggle("is-reading", !!stage);
    if (!stage) { previousKey = null; return; }
    const body = stage.querySelector(".idea-body"), button = stage.querySelector(".reveal-text");
    const text = body.textContent;
    const key = JSON.stringify([stage.dataset.readingCard, stage.textContent, body.lang]);
    const fresh = key !== previousKey;
    previousKey = key;
    if (!fresh || motion.matches || doc.hidden || !text) { dispose = () => {}; return; }

    stage.classList.add("is-arriving", "is-writing");
    button.tabIndex = 0;
    // Reserve the final layout and expose the full text once to assistive technology.
    const full = doc.createElement("span"), space = doc.createElement("span"), ink = doc.createElement("span");
    full.className = "sr-only"; full.textContent = text;
    space.className = "typewriter-space"; space.textContent = text; space.setAttribute("aria-hidden", "true");
    ink.className = "typewriter-ink"; ink.setAttribute("aria-hidden", "true");
    body.replaceChildren(full, space, ink);
    body.classList.add("is-typewriting");
    const characters = typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter(body.lang || undefined, {granularity:"grapheme"}).segment(text)].map(part => part.segment) : Array.from(text);
    const duration = Math.min(4600, Math.max(1400, characters.length * 18));
    let frame = 0, start = null, finished = false, count = 0;

    function finish() {
      if (finished) return;
      finished = true;
      win.cancelAnimationFrame(frame);
      body.replaceChildren(doc.createTextNode(text));
      body.classList.remove("is-typewriting");
      stage.classList.remove("is-writing");
      button.tabIndex = -1;
    }
    function reveal(now) {
      start ??= now;
      const elapsed = Math.max(0, now - start - 320);
      const next = Math.min(characters.length, Math.floor(elapsed / duration * characters.length));
      if (next !== count) { count = next; ink.textContent = characters.slice(0, count).join(""); }
      if (elapsed >= duration) finish();
      else frame = win.requestAnimationFrame(reveal);
    }
    function skip() {
      finish();
      stage.querySelector("#idea-content")?.focus({preventScroll:true});
    }
    function reduceMotion() { if (motion.matches) finish(); }
    function hide() { if (doc.hidden) finish(); }
    button.addEventListener("click", skip);
    motion.addEventListener("change", reduceMotion);
    doc.addEventListener("visibilitychange", hide);
    frame = win.requestAnimationFrame(reveal);
    dispose = () => {
      finish();
      button.removeEventListener("click", skip);
      motion.removeEventListener("change", reduceMotion);
      doc.removeEventListener("visibilitychange", hide);
    };
  };
}

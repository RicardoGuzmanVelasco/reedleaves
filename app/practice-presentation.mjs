// The session owns progress; this controller owns only the disposable visual scene.
// Every asynchronous continuation is tied to one mounted scene, never to a timer
// capable of advancing a later session.
export function createPracticePresentation({window: win = window, document: doc = document, presentReading} = {}) {
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
  let current = null;

  function dispose() {
    if (!current) return;
    current.cancelled = true;
    for (const animation of current.animations) animation.cancel();
    current.cleanup();
    current = null;
  }

  function animate(scene, element, frames, options) {
    if (scene.cancelled) return Promise.resolve();
    const animation = element.animate(frames, {fill:"both", ...options});
    scene.animations.add(animation);
    return animation.finished.then(() => {
      if (!scene.cancelled && !scene.skipped) {
        const last = frames.at(-1);
        for (const property of ["transform","opacity"]) if (property in last) element.style[property] = last[property];
      }
    }).catch(() => {}).finally(() => {
      animation.cancel();
      scene.animations.delete(animation);
    });
  }

  function present(main, {intro = false, ready = false, onReady = () => {}} = {}) {
    dispose();
    const root = main.querySelector(".practice-session");
    if (!root) { presentReading(main); return; }
    const scene = current = {
      root, main, flight:root.querySelector(".practice-card-flight"),
      front:root.querySelector("[data-reading-card]"),
      backs:[...root.querySelectorAll(".practice-pile > .practice-card-back")],
      buttons:[...root.querySelectorAll('[data-action="practice-answer"]')],
      animations:new Set(), cancelled:false, settled:false, cleanup:() => {}
    };
    const responsesLocked = scene.buttons.some(button => button.disabled);
    const remaining = Number(root.dataset.practiceRemaining);
    function trimPile() {
      scene.backs.forEach((back, index) => { back.hidden = index >= remaining - 1; });
    }
    function setReadable(readable) {
      scene.front.inert = !readable;
      if (readable) scene.front.removeAttribute("aria-hidden");
      else scene.front.setAttribute("aria-hidden", "true");
    }
    function finish() {
      if (scene.cancelled || scene.settled) return;
      scene.settled = true;
      scene.cleanup();
      trimPile();
      root.dataset.phase = "reading";
      scene.flight.style.transform = "";
      scene.flight.style.opacity = "";
      setReadable(true);
      scene.buttons.forEach(button => { button.disabled = responsesLocked; });
      onReady();
    }
    function skip() {
      if (scene.cancelled || scene.settled) return;
      // Invalidate the pending choreography before cancelling its promises.
      scene.skipped = true;
      for (const animation of scene.animations) animation.cancel();
      presentReading(main, {arrival:false});
      finish();
    }
    if (ready || motion.matches || doc.hidden || !scene.flight.animate) {
      presentReading(main, {arrival:false});
      finish();
      return;
    }
    const onMotion = () => { if (motion.matches) skip(); };
    const onVisibility = () => { if (doc.hidden) skip(); };
    motion.addEventListener("change", onMotion);
    doc.addEventListener("visibilitychange", onVisibility);
    scene.cleanup = () => {
      motion.removeEventListener("change", onMotion);
      doc.removeEventListener("visibilitychange", onVisibility);
    };
    scene.buttons.forEach(button => { button.disabled = true; });
    setReadable(false);
    root.dataset.phase = intro ? "preparing" : "flipping";
    scene.flight.style.transform = "rotateY(180deg)";
    const alive = () => !scene.cancelled && !scene.skipped;

    async function enter() {
      if (intro) {
        scene.backs.forEach(back => { back.hidden = false; });
        // Equal-size sheets leave the tower alternately, then settle in one pile.
        await Promise.all(scene.backs.map((back, index) => {
          const side = index % 2 ? 1 : -1, depth = (index + 1) * 4;
          return animate(scene, back, [
            {transform:`translate3d(0,${-125-index*12}px,0) rotate(${side*2}deg)`,opacity:0,offset:0},
            {transform:`translate3d(0,${-100-index*10}px,0) rotate(${side*2}deg)`,opacity:1,offset:.16},
            {transform:`translate3d(${side*78}px,${-43-index*4}px,0) rotate(${side*13}deg)`,opacity:1,offset:.48},
            {transform:`translate3d(${side*3}px,${depth+5}px,0) rotate(${side*.6}deg)`,opacity:1,offset:.84},
            {transform:`translate3d(0,${depth}px,0) rotate(0deg)`,opacity:1}
          ], {duration:1180,delay:index*65,easing:"cubic-bezier(.25,.7,.25,1)"});
        }));
        if (!alive()) return;
        // Lift the session packet while the surplus slides out underneath it.
        // Keep the first card face-down here; the flight replaces it at the turn.
        await Promise.all(scene.backs.map((back, index) => {
          const depth = (index + 1) * 4;
          const keep = index < remaining;
          return animate(scene, back, keep ? [
            {transform:`translate3d(0,${depth}px,0) rotate(0deg)`},
            {transform:`translate3d(-10px,${depth-26}px,0) rotate(-3deg)`,offset:.32},
            {transform:`translate3d(-10px,${depth-26}px,0) rotate(-3deg)`,offset:.62},
            {transform:`translate3d(0,${depth}px,0) rotate(0deg)`}
          ] : [
            {transform:`translate3d(0,${depth}px,0) rotate(0deg)`,opacity:1},
            {transform:`translate3d(22%,${depth+6}px,0) rotate(4deg)`,opacity:1,offset:.32},
            {transform:`translate3d(110%,${depth+16}px,0) rotate(9deg)`,opacity:1,offset:.7},
            {transform:`translate3d(155%,${depth+22}px,0) rotate(12deg)`,opacity:0}
          ], {duration:720,easing:"cubic-bezier(.4,0,.25,1)"});
        }));
        if (!alive()) return;
      }
      trimPile();
      root.dataset.phase = "flipping";
      // Separate half-turns let writing begin only once the front faces the reader.
      await animate(scene, scene.flight, [
        {transform:"translateY(0) rotateY(180deg) scale(1)"},
        {transform:"translateY(-30px) rotateY(148deg) scale(1.08)",offset:.45},
        {transform:"translateY(-42px) rotateY(90deg) scale(1.16)"}
      ], {duration:390,easing:"cubic-bezier(.45,0,.65,.6)"});
      if (!alive()) return;
      setReadable(true);
      presentReading(main, {arrival:false,delay:160});
      await animate(scene, scene.flight, [
        {transform:"translateY(-42px) rotateY(90deg) scale(.92)"},
        {transform:"translateY(-6px) rotateY(-3deg) scale(1.055)",offset:.61},
        {transform:"translateY(2px) rotateY(.6deg) scale(1.012)",offset:.82},
        {transform:"translateY(0) rotateY(0) scale(1)"}
      ], {duration:680,easing:"cubic-bezier(.16,.8,.26,1)"});
      if (!alive()) return;
      finish();
    }
    void enter();
  }

  async function leave(direction) {
    const scene = current;
    if (!scene || !scene.settled || scene.cancelled) return;
    scene.buttons.forEach(button => {
      button.disabled = true;
      button.classList.toggle("is-selected",button.dataset.answer === (direction === "left" ? "soon" : "remembered"));
    });
    // Finish any remaining typewriting without remounting the card.
    presentReading(scene.main, {arrival:false});
    scene.root.dataset.phase = "leaving";
    if (motion.matches || doc.hidden || !scene.flight.animate) return;
    const skipDeparture = () => {
      if (!motion.matches && !doc.hidden) return;
      for (const animation of scene.animations) animation.cancel();
      scene.flight.style.opacity = "0";
    };
    motion.addEventListener("change",skipDeparture);
    doc.addEventListener("visibilitychange",skipDeparture);
    scene.cleanup = () => {
      motion.removeEventListener("change",skipDeparture);
      doc.removeEventListener("visibilitychange",skipDeparture);
    };
    const sign = direction === "left" ? -1 : 1;
    await animate(scene, scene.flight, [
      {transform:"translateX(0) rotate(0)",opacity:1,offset:0},
      {transform:`translateX(${sign*42}%) rotate(${sign*4}deg)`,opacity:1,offset:.78},
      {transform:`translateX(${sign*68}%) rotate(${sign*6}deg)`,opacity:0,offset:1}
    ], {duration:620,easing:"cubic-bezier(.3,.65,.3,1)"});
    scene.cleanup();
  }

  return {present,leave,dispose};
}

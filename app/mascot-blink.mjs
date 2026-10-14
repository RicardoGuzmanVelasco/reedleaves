export const mascotBlinkTiming = Object.freeze({minDelay:3000,maxDelay:7000,duration:160});

const controllers = new WeakMap();

// One controller per document follows the shared markup across navigation and previews.
export function startMascotBlinking(doc, {
  random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout,
  Observer = doc.defaultView.MutationObserver
} = {}) {
  if (controllers.has(doc)) return controllers.get(doc);
  const reducedMotion = doc.defaultView.matchMedia("(prefers-reduced-motion: reduce)");
  const pending = new Map();
  const selector = '.mascot-art:not([data-idle="none"])';
  const eligible = art => art.isConnected && art.matches(selector) && !!art.querySelector('.mascot-face[data-expression="neutral"]');

  function remove(art) {
    clearTimer(pending.get(art));
    pending.delete(art);
    art.classList.remove("is-auto-blinking");
  }
  function finish(art) {
    clearTimer(pending.get(art));
    art.classList.remove("is-auto-blinking");
    if (doc.hidden || reducedMotion.matches || !eligible(art)) remove(art);
    else schedule(art);
  }
  function schedule(art) {
    const {minDelay,maxDelay} = mascotBlinkTiming;
    pending.set(art,setTimer(() => {
      if (doc.hidden || reducedMotion.matches || !eligible(art)) { remove(art); return; }
      const eyes = [...art.querySelectorAll(".mascot-eye-expression")];
      // Explicit eye gestures take priority. Hidden previews do not need animation.
      if (!art.getClientRects().length || eyes.some(eye => eye.getAnimations().some(animation => animation.playState === "running"))) {
        schedule(art); return;
      }
      art.classList.add("is-auto-blinking");
      // Let CSS finish its 160 ms even when it starts on the next render frame.
      // The fallback also recovers if a manual gesture cancels the eye animation.
      pending.set(art,setTimer(() => finish(art),mascotBlinkTiming.duration+80));
    },minDelay + random() * (maxDelay-minDelay)));
  }
  function sync() {
    const arts = new Set(doc.hidden || reducedMotion.matches ? [] : [...doc.querySelectorAll(selector)].filter(eligible));
    for (const art of pending.keys()) if (!arts.has(art)) remove(art);
    for (const art of arts) if (!pending.has(art)) schedule(art);
  }
  const observer = new Observer(sync);
  function animationEnd(event) {
    if (event.animationName !== "mascot-eye-blink") return;
    const art = event.target.closest(".mascot-art");
    if (pending.has(art) && art.classList.contains("is-auto-blinking")) finish(art);
  }
  observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["data-idle","data-expression"]});
  doc.addEventListener("animationend",animationEnd);
  doc.addEventListener("visibilitychange",sync);
  reducedMotion.addEventListener("change",sync);
  function stop() {
    observer.disconnect();
    doc.removeEventListener("animationend",animationEnd);
    doc.removeEventListener("visibilitychange",sync);
    reducedMotion.removeEventListener("change",sync);
    for (const art of pending.keys()) remove(art);
    controllers.delete(doc);
  }
  controllers.set(doc,stop);
  sync();
  return stop;
}

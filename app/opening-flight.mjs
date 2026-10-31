// Observe the animation that started at first paint, without restarting it or
// duplicating its duration in JavaScript. A cancelled or absent animation
// must never prevent the app from opening.
export function waitForOpeningFlight(root, reducedMotion = false) {
  if (reducedMotion) return Promise.resolve();
  const mascot = root.querySelector(".opening-sprout .mascot-art");
  const flight = mascot?.getAnimations?.().find(animation => animation.animationName === "opening-sprout-flight");
  return flight ? flight.finished.catch(() => {}) : Promise.resolve();
}

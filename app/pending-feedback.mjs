/**
 * When a wait shows its loading feedback. A wait that is expected to be long (`slow`) shows it at once; one that
 * is expected to be quick shows it only if it lasts longer than `delay`, so fast loads never flash the sprout
 * and a bad connection still gets it. While it is hidden the current screen stays as it is.
 */
export function createPendingFeedback({delay=300,onChange=()=>{},schedule=setTimeout,cancel=clearTimeout}={}) {
  let pending=false,visible=false,timer=null;
  const show=()=>{timer=null;if(pending&&!visible){visible=true;onChange(true);}};
  return {
    get pending() {return pending;},
    get visible() {return visible;},
    start({slow=false}={}) {
      cancel(timer);timer=null;pending=true;visible=false;
      if(slow)show();else timer=schedule(show,delay);
    },
    end() {
      cancel(timer);timer=null;
      const wasVisible=visible;pending=false;visible=false;
      return wasVisible;
    }
  };
}

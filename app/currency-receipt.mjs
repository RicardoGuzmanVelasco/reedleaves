// Presentation only. The owner first applies a fresh /api/session state, then
// passes the initial-operation receipt on Home. Never credit a local wallet.
export const CURRENCY_RECEIPT_STEP_MS=360;
const validBalance=value=>Number.isSafeInteger(value)&&value>=0;
export function currencyReceiptSteps(newlyGranted,current) {
  const seen=new Set(),rows=[];
  for(const row of Array.isArray(newlyGranted)?newlyGranted:[]) {
    if(!["leaves","petals"].includes(row?.currency)||typeof row.rewardType!=="string"||seen.has(row.rewardType)||
      !Number.isSafeInteger(row.amount)||row.amount<=0||!validBalance(row.balanceAfter)||row.balanceAfter<row.amount||current[row.currency]!==row.balanceAfter)continue;
    seen.add(row.rewardType);rows.push({...row});
  }
  // A malformed receipt containing multiple claims for one currency is ignored.
  return rows.filter(row=>rows.filter(other=>other.currency===row.currency).length===1);
}

export function createCurrencyReceiptPresentation({readCurrent,onDisplay,onPulse=()=>{},reducedMotion=()=>false,schedule=setTimeout,cancel=clearTimeout}) {
  let scene=null;
  const consumed=new Set();
  const displayCurrent=()=>{const current=readCurrent();if(current)onDisplay({leaves:current.leaves,petals:current.petals});};
  function stop(){if(scene){cancel(scene.timer);scene=null;}displayCurrent();}
  function unchanged(active){
    const current=readCurrent();
    return current?.userId===active.userId&&current.leaves===active.final.leaves&&current.petals===active.final.petals;
  }
  return {
    present({userId,newlyGranted}) {
      stop();const current=readCurrent();
      if(!userId||current?.userId!==userId)return;
      const rows=currencyReceiptSteps(newlyGranted,current).filter(row=>!consumed.has(`${userId}:${row.rewardType}`));
      for(const row of rows)consumed.add(`${userId}:${row.rewardType}`);
      if(!rows.length||reducedMotion()){displayCurrent();return;}
      const active=scene={userId,final:{leaves:current.leaves,petals:current.petals},display:{leaves:current.leaves,petals:current.petals},rows,index:0,timer:null};
      for(const row of rows)active.display[row.currency]=row.balanceAfter-row.amount;
      onDisplay({...active.display});
      const tick=()=>{
        if(scene!==active)return;
        if(!unchanged(active)||reducedMotion()){stop();return;}
        const row=rows[active.index];
        active.display[row.currency]++;
        onDisplay({...active.display});onPulse(row.currency);
        if(active.display[row.currency]===row.balanceAfter)active.index++;
        if(active.index===rows.length){scene=null;displayCurrent();return;}
        active.timer=schedule(tick,CURRENCY_RECEIPT_STEP_MS);
      };
      active.timer=schedule(tick,CURRENCY_RECEIPT_STEP_MS);
    },
    // Header renders and background sync call this; a newer authoritative balance
    // or account change supersedes the disposable animation immediately.
    sync(){if(scene&&unchanged(scene)&&!reducedMotion())onDisplay({...scene.display});else stop();},
    dispose:stop
  };
}

export function pulseCurrencyWallet(document,currency,{reducedMotion=false}={}) {
  if(reducedMotion)return;
  const count=document.getElementById(currency==="leaves"?"leaf-count":"petal-count"),wallet=count?.closest(".wallet");
  if(!wallet?.animate)return;
  for(const animation of wallet.getAnimations())animation.cancel();
  wallet.animate([{transform:"scale(1)"},{transform:"scale(1.22)",offset:.42},{transform:"scale(1)"}],{duration:CURRENCY_RECEIPT_STEP_MS,easing:"cubic-bezier(.2,.75,.3,1)"});
}

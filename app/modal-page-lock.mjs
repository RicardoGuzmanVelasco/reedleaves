export function createModalPageLock({document,window,getComputedStyle}) {
  let saved=null;
  return locked=>{
    const {body,documentElement:root}=document;
    if(locked){
      if(saved)return;
      const bodyProperties=["position","top","left","right","width","overflow","padding-right"];
      const savedBody=Object.fromEntries(bodyProperties.map(property=>[property,[body.style.getPropertyValue(property),body.style.getPropertyPriority(property)]]));
      const savedRoot=Object.fromEntries(["overflow","scroll-behavior"].map(property=>[property,[root.style.getPropertyValue(property),root.style.getPropertyPriority(property)]]));
      const scrollY=window.scrollY,scrollbarWidth=Math.max(0,window.innerWidth-root.clientWidth);
      saved={scrollY,savedBody,savedRoot};
      body.style.setProperty("position","fixed");body.style.setProperty("top",`-${scrollY}px`);body.style.setProperty("left","0");body.style.setProperty("right","0");body.style.setProperty("width","auto");body.style.setProperty("overflow","hidden");
      if(scrollbarWidth)body.style.setProperty("padding-right",`${(parseFloat(getComputedStyle(body).paddingRight)||0)+scrollbarWidth}px`);
      root.style.setProperty("overflow","hidden");root.style.setProperty("scroll-behavior","auto");
      return;
    }
    if(!saved)return;
    const {scrollY,savedBody,savedRoot}=saved;saved=null;
    for(const [property,[value,priority]] of Object.entries(savedBody)){if(value)body.style.setProperty(property,value,priority);else body.style.removeProperty(property)}
    const [rootOverflow,rootOverflowPriority]=savedRoot.overflow;if(rootOverflow)root.style.setProperty("overflow",rootOverflow,rootOverflowPriority);else root.style.removeProperty("overflow");
    window.scrollTo(0,scrollY);
    const [scrollBehavior,scrollBehaviorPriority]=savedRoot["scroll-behavior"];if(scrollBehavior)root.style.setProperty("scroll-behavior",scrollBehavior,scrollBehaviorPriority);else root.style.removeProperty("scroll-behavior");
  };
}

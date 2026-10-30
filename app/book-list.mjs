// Presentation only: callers resolve language, permissions, destinations and data.
const esc=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const BOOK_VIEWS=['covers','shelf','stack'];
export const BOOK_SHELF_THRESHOLD=10;
export const selectedBookView=(preferred,fallback)=>BOOK_VIEWS.includes(preferred)?preferred:fallback;
export const defaultBookView=(count,preferred)=>selectedBookView(preferred,count>=BOOK_SHELF_THRESHOLD?'shelf':'covers');
export function partitionLibraryBooks(books,newBookIds=[]){
  const newIds=new Set(Array.isArray(newBookIds)?newBookIds:[]);
  return {newBooks:books.filter(book=>newIds.has(book.id)),otherBooks:books.filter(book=>!newIds.has(book.id))};
}
export const leaningBookIndex=(count,columns)=>count%columns>1?count-1:-1;
export function bookViewSelector(view,scope,language='es',trailing=''){
  const labels=language==='es'?['Portadas','Estantería densa','Libros apilados']:['Covers','Dense shelf','Stacked books'];
  return `<div class="book-list-tools"><div class="segmented-selector book-view-selector" role="group" aria-label="${language==='es'?'Vista de libros':'Book view'}">${BOOK_VIEWS.map((value,index)=>`<button type="button" data-action="set-book-view" data-scope="${esc(scope)}" data-view="${value}" aria-pressed="${view===value}" aria-label="${labels[index]}" title="${labels[index]}"><img src="../brand/icons/book-layout/${value}.svg" width="24" height="24" alt="" aria-hidden="true"></button>`).join('')}</div>${trailing}</div>`;
}
export function bookListMarkup({books,view='covers',label='',cover}){
  if(view==='covers')return `<div class="study-books book-grid" role="group" aria-label="${esc(label)}">${books.map(cover).join('')}</div>`;
  const ordered=books;
  return `<div class="book-spines book-spines--${view}" data-book-spines="${view}" role="list" aria-label="${esc(label)}">${ordered.map(book=>`<div class="book-spine-item" role="listitem"><a class="book-spine" href="${esc(book.href)}" ${book.action?`data-action="${esc(book.action)}" data-book="${esc(book.id)}" aria-haspopup="dialog"`:''} aria-label="${esc(book.title+', '+book.author)}"><span class="book-spine-title" lang="${esc(book.language)}" dir="auto">${esc(book.title)}</span></a>${book.accessory||''}</div>`).join('')}</div>`;
}
export function bookVariation(text,salt){let seed=2166136261;for(const char of text+'|'+salt){seed^=char.charCodeAt(0);seed=Math.imul(seed,16777619);}return (seed>>>0)/4294967295;}
// Each mount owns observers; dispose before replacing its DOM.
export function mountBookLists(root){
  const lists=[...root.querySelectorAll('[data-book-spines]')];
  if(!lists.length)return ()=>{};
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  let frame=0,disposed=false;
  function refresh(){
    for(const list of lists){
      const width=list.clientWidth;if(!width)continue;
      const vertical=list.dataset.bookSpines==='shelf';
      const columns=Math.max(1,Math.floor((width+2)/34));
      list.style.setProperty('--spine-columns',columns);
      const items=[...list.children];
      items.forEach((item,index)=>{
        const book=item.querySelector('.book-spine'),title=book.querySelector('.book-spine-title'),text=title.textContent;
        const style=getComputedStyle(title),padding=vertical?16:24,nominal=vertical?184:Math.min(width-parseFloat(getComputedStyle(list).paddingLeft)-parseFloat(getComputedStyle(list).paddingRight),360);
        const measure=size=>{if(!context)return text.length*size*.65;context.font=`800 ${size}px ${style.fontFamily}`;return context.measureText(text).width-Math.max(0,Array.from(text).length-1)*size*.035;};
        const min=vertical?15:14,max=vertical?16:18;
        let size=max;while(size>min&&measure(size)>nominal-padding-3)size-=.25;
        const full=measure(size)+padding+4,factor=bookVariation(text,'length');
        let length=vertical?nominal*(.78+factor*.21):nominal;
        if(vertical&&full<=nominal)length=Math.max(length,full);
        if(!vertical&&full<=nominal)length=Math.max(full,nominal*((full<nominal*.7?.68:.78)+factor*.21));
        length=Math.ceil(Math.min(nominal,length));
        item.style.setProperty('--spine-length',length+'px');title.style.fontSize=size+'px';
        book.classList.remove('is-leaning');
        // The empty column supplies space for the foot; the top touches its neighbour.
        if(vertical&&index===leaningBookIndex(items.length,columns)){
          book.classList.add('is-leaning');
        }
        if(!vertical){
          const atBase=index===items.length-1;
          item.style.setProperty('--spine-offset',atBase?'0px':((bookVariation(text,'offset')-.5)*12).toFixed(2)+'px');
          item.style.setProperty('--spine-tilt',atBase?'0deg':((bookVariation(text,'tilt')-.5)*1.2).toFixed(2)+'deg');
        }
        // Browser measurement wins over canvas estimates for fallback fonts.
        while(title.scrollWidth>title.clientWidth&&size>min){size=Math.max(min,size-.25);title.style.fontSize=size+'px';}
        title.style.textAlign=vertical&&title.scrollWidth<=title.clientWidth?'center':'left';
        book.title=text;
      });
    }
  }
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;refresh();});};
  const observer=globalThis.ResizeObserver?new ResizeObserver(schedule):null;
  lists.forEach(list=>observer?.observe(list));
  refresh();document.fonts?.ready.then(schedule);
  return ()=>{disposed=true;observer?.disconnect();if(frame)cancelAnimationFrame(frame);};
}

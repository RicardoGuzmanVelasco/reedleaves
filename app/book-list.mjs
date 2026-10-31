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
export function wrapSpineTitle(text,measure,maxWidth){
  const lines=[];let line='';
  for(const word of String(text).trim().split(/\s+/).filter(Boolean)){
    if(measure(word)>maxWidth){
      if(line){lines.push(line);line='';}
      let part='';
      for(const character of Array.from(word)){
        if(part&&measure(part+character)>maxWidth){lines.push(part);part=character;}else part+=character;
      }
      line=part;
    }else{
      const next=line?line+' '+word:word;
      if(line&&measure(next)>maxWidth){lines.push(line);line=word;}else line=next;
    }
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}
export function bookViewSelector(view,scope,language='es',trailing=''){
  const labels=language==='es'?['Portadas','Estantería densa','Libros apilados']:['Covers','Dense shelf','Stacked books'];
  return `<div class="book-list-tools"><div class="segmented-selector book-view-selector" role="group" aria-label="${language==='es'?'Vista de libros':'Book view'}">${BOOK_VIEWS.map((value,index)=>`<button type="button" data-action="set-book-view" data-scope="${esc(scope)}" data-view="${value}" aria-pressed="${view===value}" aria-label="${labels[index]}" title="${labels[index]}"><span class="book-view-icon book-view-icon--${value}" aria-hidden="true"></span></button>`).join('')}</div>${trailing}</div>`;
}
export function bookListMarkup({books,view='covers',label='',cover}){
  if(view==='covers')return `<div class="study-books book-grid" role="group" aria-label="${esc(label)}">${books.map(cover).join('')}</div>`;
  const itemMarkup=book=>`<div class="book-spine-item" role="listitem"><a class="book-spine" href="${esc(book.href)}" ${book.action?`data-action="${esc(book.action)}" data-book="${esc(book.id)}" aria-haspopup="dialog"`:''} aria-label="${esc(book.title+', '+book.author)}"><span class="book-spine-title" lang="${esc(book.language)}" dir="auto">${esc(book.title)}</span></a>${book.accessory||''}</div>`;
  const content=view==='shelf'?Array.from({length:Math.ceil(books.length/10)},(_,index)=>`<div class="book-shelf-row" role="presentation">${books.slice(index*10,index*10+10).map(itemMarkup).join('')}</div>`).join(''):books.map(itemMarkup).join('');
  return `<div class="book-spines book-spines--${view}" data-book-spines="${view}" role="list" aria-label="${esc(label)}">${content}</div>`;
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
      const fontSize=15;
      const measure=(text,size,title)=>{
        if(!context)return text.length*size*.65;
        context.font=`800 ${size}px ${getComputedStyle(title).fontFamily}`;
        return context.measureText(text).width-Math.max(0,Array.from(text).length-1)*size*.035;
      };
      if(vertical){
        const rows=[...list.children],lineThickness=fontSize*1.15;
        const rowLayouts=rows.map((row,rowIndex)=>{
          const items=[...row.children],layouts=items.map(item=>{
            const book=item.querySelector('.book-spine'),title=book.querySelector('.book-spine-title');
            const text=title.dataset.fullText??(title.dataset.fullText=title.textContent);
            const height=Math.ceil(184*(.78+bookVariation(text,'length')*.21));
            let size=fontSize,lines=wrapSpineTitle(text,value=>measure(value,size,title),Math.max(40,height-16));
            while(lines.length>3&&size>11){size-=.5;lines=wrapSpineTitle(text,value=>measure(value,size,title),Math.max(40,height-16));}
            if(lines.length>3)lines=[lines[0],lines[1],lines.slice(2).join(' ')];
            title.style.fontSize=size+'px';title.style.setProperty('--spine-title-length',`${Math.max(40,height-16)}px`);title.style.textAlign='center';
            title.replaceChildren(...lines.map(line=>{const span=document.createElement('span');span.className='book-spine-line';span.textContent=line;return span;}));
            title.dataset.lines=String(lines.length);
            item.style.setProperty('--spine-length',height+'px');
            book.title=text;book.classList.remove('is-leaning');
            return {item,book,lines};
          });
          return {row,rowIndex,items,layouts,extraLines:layouts.reduce((total,entry)=>total+entry.lines.length-1,0)};
        });
        const extraLines=Math.max(0,...rowLayouts.map(layout=>layout.extraLines));
        const gap=parseFloat(getComputedStyle(rows[0]||list).columnGap)||0;
        const baseWidth=Math.max(18,(width-gap*9-extraLines*lineThickness)/10);
        rowLayouts.forEach(({rowIndex,items,layouts})=>{
          layouts.forEach(({item,book,lines},index)=>{
            item.style.setProperty('--spine-width',`${baseWidth+(lines.length-1)*lineThickness}px`);
            if(rowIndex===rows.length-1&&items.length<10&&items.length>1&&index===items.length-1)book.classList.add('is-leaning');
          });
        });
        continue;
      }
      const items=[...list.children];
      items.forEach((item,index)=>{
        const book=item.querySelector('.book-spine'),title=book.querySelector('.book-spine-title');
        const text=title.textContent,padding=24,nominal=Math.min(width-parseFloat(getComputedStyle(list).paddingLeft)-parseFloat(getComputedStyle(list).paddingRight),360);
        const full=measure(text,18,title)+padding+4,factor=bookVariation(text,'length');
        let size=18,length=nominal;
        if(full<=nominal)length=Math.max(full,nominal*((full<nominal*.7?.68:.78)+factor*.21));
        length=Math.ceil(Math.min(nominal,length));
        item.style.setProperty('--spine-length',length+'px');title.style.fontSize=size+'px';
        while(title.scrollWidth>title.clientWidth&&size>14){size=Math.max(14,size-.25);title.style.fontSize=size+'px';}
        book.classList.remove('is-leaning');
        const atBase=index===items.length-1;
        item.style.setProperty('--spine-offset',atBase?'0px':((bookVariation(text,'offset')-.5)*12).toFixed(2)+'px');
        item.style.setProperty('--spine-tilt',atBase?'0deg':((bookVariation(text,'tilt')-.5)*1.2).toFixed(2)+'deg');
        title.style.textAlign='left';book.title=text;
      });
    }
  }
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;refresh();});};
  const observer=globalThis.ResizeObserver?new ResizeObserver(schedule):null;
  lists.forEach(list=>observer?.observe(list));
  refresh();document.fonts?.ready.then(schedule);
  return ()=>{disposed=true;observer?.disconnect();if(frame)cancelAnimationFrame(frame);};
}

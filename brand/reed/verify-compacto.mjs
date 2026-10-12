import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const svg = readFileSync(new URL("./d-compacto.svg", import.meta.url), "utf8");
function polygon(d){
const t=d.match(/[MLHVQCZmlhvqcz]|-?\d*\.?\d+/g);let i=0,x=0,y=0,sx=0,sy=0,command="";const out=[];
const n=()=>+t[i++],add=(a,b)=>out.push([a,b]);
while(i<t.length){
if(/^[a-z]$/i.test(t[i]))command=t[i++];
const rel=command===command.toLowerCase(),u=command.toUpperCase(),ox=x,oy=y;
if(u==="Z"){x=sx;y=sy;add(x,y);command="";continue;}
if(u==="M"||u==="L"){x=n()+(rel?ox:0);y=n()+(rel?oy:0);if(u==="M"){sx=x;sy=y;command=rel?"l":"L";}add(x,y);}
else if(u==="V"){y=n()+(rel?oy:0);add(x,y);}
else if(u==="H"){x=n()+(rel?ox:0);add(x,y);}
else if(u==="Q"){const a=n()+(rel?ox:0),b=n()+(rel?oy:0),ex=n()+(rel?ox:0),ey=n()+(rel?oy:0);for(let k=1;k<=160;k++){const s=k/160,v=1-s;add(v*v*ox+2*v*s*a+s*s*ex,v*v*oy+2*v*s*b+s*s*ey);}x=ex;y=ey;}
else if(u==="C"){const a=n()+(rel?ox:0),b=n()+(rel?oy:0),c1=n()+(rel?ox:0),d1=n()+(rel?oy:0),ex=n()+(rel?ox:0),ey=n()+(rel?oy:0);for(let k=1;k<=160;k++){const s=k/160,v=1-s;add(v**3*ox+3*v*v*s*a+3*v*s*s*c1+s**3*ex,v**3*oy+3*v*v*s*b+3*v*s*s*d1+s**3*ey);}x=ex;y=ey;}
else throw new Error("unsupported "+command);
}
return out;
}
function distance(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function inside(p,poly){
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [x,y]=poly[i],[a,b]=poly[j];
    if((y>p[1])!==(b>p[1])&&p[0]<(a-x)*(p[1]-y)/(b-y)+x)hit=!hit;
  }
  return hit;
}
const pageTag=svg.match(/<g id="book">[\s\S]*?(<path[^>]+stroke-width="7"[^>]*>)/)[1];
const page=polygon(pageTag.match(/d="([^"]+)"/)[1]);
const border=Number(pageTag.match(/stroke-width="([^"]+)"/)[1])/2;
const outer=svg.match(/id="leaf" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"/);
const [tx,ty,scale]=outer.slice(1).map(Number);
const leaf=svg.match(/<g id="leaf"[^>]*>([\s\S]*?)<\/g>/)[1];
const points=[...leaf.matchAll(/<path d="([^"]+)"/g)].flatMap(p=>polygon(p[1]).map(([x,y])=>[tx+scale*x,ty+scale*y]));
const outside=points.filter(p=>!inside(p,page)).length;
const contour=Math.min(...points.map(p=>Math.min(...page.map((a,i)=>distance(p,a,page[(i+1)%page.length])))))-border;
const fold=Math.min(...points.map(p=>distance(p,[128,97],[128,224])))-1.5;
assert.equal(outside,0,"Alguna hoja o sombra sale de las páginas");
assert.ok(contour>=3.9,"Margen insuficiente con el contorno");
// La cercanía al pliegue se conserva por elección explícita del usuario.
assert.equal((svg.match(/fill="#1E4C2E"/g)||[]).length,1,"Solo la sombra exterior del libro es oscura");
const original=readFileSync(new URL("./colors/salvia.svg",import.meta.url),"utf8");
const normalize=s=>s.replace(/aria-label="[^"]*"/,'aria-label="normalized"').trim();
// Prueba de papel verde claro solicitada por el usuario: geometría y hojas intactas.
const expected=original.replace('fill="#369247"','fill="#1E4C2E"').replace('fill="#FFF9ED"','fill="#E8F3DF"');
assert.equal(normalize(svg),normalize(expected),"Solo deben cambiar los colores de la sombra exterior y del papel del libro");
assert.equal((svg.match(/stroke="#779A72"/g)||[]).length,2,"Contorno y pliegue deben usar B Salvia");
assert.ok(!svg.includes('id="face"'));
console.log(JSON.stringify({sampledPoints:points.length,outside,contourClearance:+contour.toFixed(2),foldClearance:+fold.toFixed(2)}));

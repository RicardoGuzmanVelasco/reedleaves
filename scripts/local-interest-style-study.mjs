import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,sep,extname} from "node:path";
import {parseCsv} from "../server/csv.mjs";

if(process.env.NODE_ENV==="production")throw new Error("This study runs only in a local development environment");
const root=fileURLToPath(new URL("../",import.meta.url));
const types={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2"};
const server=createServer(async(request,response)=>{
  response.setHeader("Cache-Control","no-store");
  response.setHeader("X-Content-Type-Options","nosniff");
  response.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'");
  if(request.method!=="GET"){response.writeHead(405).end();return;}
  try{
    const url=new URL(request.url,"http://127.0.0.1");
    if(url.pathname==="/"){response.writeHead(302,{Location:"/brand/interest-style-study/index.html"}).end();return;}
    if(url.pathname==="/studio/catalog"){
      const rows=parseCsv(await readFile(resolve(root,"content/catalog/genres.csv"),"utf8"));
      const palette=new Map(parseCsv(await readFile(resolve(root,"brand/interest-style-study/palette.csv"),"utf8")).map(row=>[row.id,row.color]));
      const genres=rows.map(row=>({id:row.id,name:{es:row.name_es,en:row.name_en},emoji:row.emoji,color:url.searchParams.get("variant")==="proposal"?palette.get(row.id)||row.color:row.color})).sort((a,b)=>a.id.localeCompare(b.id));
      response.setHeader("Content-Type","application/json; charset=utf-8");response.end(JSON.stringify({genres}));return;
    }
    const pathname=decodeURIComponent(url.pathname);
    if(!["/app/","/brand/interest-style-study/","/brand/reed/"].some(prefix=>pathname.startsWith(prefix))||pathname.split("/").some(part=>part.startsWith("."))){response.writeHead(404).end();return;}
    const path=resolve(root,pathname.slice(1)),type=types[extname(path)];
    if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!type){response.writeHead(404).end();return;}
    const content=await readFile(path);response.setHeader("Content-Type",type);response.end(content);
  }catch{response.writeHead(404).end();}
});
server.listen(Number(process.env.INTEREST_STUDY_PORT||0),"127.0.0.1",()=>{console.log(`Local interest study: http://127.0.0.1:${server.address().port}/`);});

import {timingSafeEqual} from "node:crypto";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {z} from "zod/v4";
import {readCatalog} from "./catalog-repository.mjs";
import {appendTeamDeckCards,createTeamDeck,finishTeamDeck} from "./author-repository.mjs";
import {ApiError} from "./errors.mjs";

function validBearer(request,token) {
  if (!token) return false;
  const header=request.headers.authorization;
  if (typeof header!=="string" || !header.startsWith("Bearer ")) return false;
  const supplied=Buffer.from(header.slice(7)),expected=Buffer.from(token);
  return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}

function toolText(value) {
  return {content:[{type:"text",text:JSON.stringify(value)}]};
}

function safeTool(handler) {
  return async input=>{
    try { return await handler(input); }
    catch(error) {
      if (error instanceof ApiError) return {isError:true,content:[{type:"text",text:JSON.stringify({error:error.code})}]};
      console.error("MCP tool failed",error);
      return {isError:true,content:[{type:"text",text:JSON.stringify({error:"toolFailed"})}]};
    }
  };
}

function makeServer(db,publicBaseUrl) {
  const server=new McpServer({name:"reedleaves-deck-authoring",version:"1.0.0"},{
    instructions:"Create Reedleaves deck drafts from the user's conversation. Find a book only when the user has not identified it clearly. Saving makes the draft visible in the shared catalog. All created decks are attributed to Equipo Reedleaves. Finish a team draft only when the user explicitly asks; finishing freezes its cards. Never invent source quotes; use isQuote only for wording supplied by the user.",
    maxToolInputElements:5000
  });
  server.registerTool("find_book",{
    title:"Buscar libro",
    description:"Search the Reedleaves catalog when the book for a deck is unknown or ambiguous.",
    inputSchema:{query:z.string().trim().min(2).max(160)},
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  },safeTool(async({query})=>{
    const catalog=await readCatalog(db);
    const needle=query.trim().toLocaleLowerCase("es");
    const matches=catalog.books.filter(book=>[
      book.originalTitle,book.author,...Object.values(book.title),...Object.values(book.shortTitle)
    ].some(value=>value?.toLocaleLowerCase("es").includes(needle))).slice(0,12).map(book=>({
      bookId:book.id,title:book.originalTitle,author:book.author,originalLanguage:book.originalLanguage,
      localizedTitles:book.title,deckCount:catalog.decks.filter(deck=>deck.bookId===book.id).length
    }));
    return toolText({matches});
  }));
  server.registerTool("create_deck",{
    title:"Crear baraja",
    description:"Save a complete deck draft to the shared Reedleaves catalog, attributed to Equipo Reedleaves. The user must have clearly asked to save/create it; saving makes it visible to other catalog users.",
    inputSchema:{
      requestId:z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).describe("Stable UUID for this creation attempt; reuse it if retrying after a timeout."),
      bookId:z.string().min(1).max(240),title:z.string().trim().min(1).max(160),
      description:z.string().trim().max(1000).optional(),editorialNote:z.string().trim().min(1).max(1000).optional(),
      language:z.string().min(2).max(35),
      cards:z.array(z.object({title:z.string().trim().max(160).optional(),body:z.string().trim().min(1).max(4000),
        isQuote:z.boolean().default(false),parentIndex:z.number().int().nonnegative().nullable().optional()})).min(1).max(120)
    },
    annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}
  },safeTool(async(input)=>{
    const result=await createTeamDeck(db,input);
    return toolText({...result,url:`${publicBaseUrl.replace(/\/+$/ ,"")}/app/#book/${encodeURIComponent(input.bookId)}`});
  }));
  server.registerTool("append_cards_to_draft",{
    title:"Añadir tarjetas a borrador",
    description:"Append cards to a draft deck created by Equipo Reedleaves. Existing cards cannot be edited or removed by this tool. Saving updates the shared catalog.",
    inputSchema:{requestId:z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).describe("Stable UUID for this append operation; reuse it when retrying."),versionId:z.string().min(1).max(280),
      cards:z.array(z.object({title:z.string().trim().max(160).optional(),body:z.string().trim().min(1).max(4000),isQuote:z.boolean().default(false),
        parentId:z.string().min(1).optional(),parentIndex:z.number().int().nonnegative().nullable().optional()})).min(1).max(120)},
    annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}
  },safeTool(async(input)=>toolText(await appendTeamDeckCards(db,input))));
  server.registerTool("finish_deck",{
    title:"Marcar baraja como terminada",
    description:"Mark a nonempty draft created by Equipo Reedleaves as finished (published). Call only when the user explicitly asks to finish that deck. Finishing freezes its cards and prevents further additions. Decks owned by other users or without an owner are rejected. Repeating this call for an already finished team deck is safe.",
    inputSchema:{versionId:z.string().trim().min(1).max(256).describe("Version ID of the team deck to finish, as returned by create_deck.")},
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false}
  },safeTool(async(input)=>toolText(await finishTeamDeck(db,input))));
  return server;
}

export async function handleMcpRequest(request,response,{db,token,publicBaseUrl="https://reedleaves.com"}) {
  if (new URL(request.url,"http://localhost").pathname!=="/mcp") return false;
  if (!token || token.length<32) {
    response.writeHead(404,{"Content-Type":"application/json; charset=utf-8"});
    response.end(JSON.stringify({error:"MCP unavailable"}));
    return true;
  }
  if (!validBearer(request,token)) {
    response.writeHead(401,{"Content-Type":"application/json; charset=utf-8","WWW-Authenticate":"Bearer realm=\"reedleaves-mcp\""});
    response.end(JSON.stringify({error:"Unauthorized"}));
    return true;
  }
  const server=makeServer(db,publicBaseUrl);
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  try {
    await server.connect(transport);
    await transport.handleRequest(request,response);
  } catch(error) {
    console.error("MCP request failed",error);
    if (!response.headersSent) {
      response.writeHead(500,{"Content-Type":"application/json; charset=utf-8"});
      response.end(JSON.stringify({error:"MCP request failed"}));
    }
  } finally {
    await transport.close().catch(()=>{});
    await server.close().catch(()=>{});
  }
  return true;
}

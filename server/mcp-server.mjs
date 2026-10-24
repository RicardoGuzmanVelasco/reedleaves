import {timingSafeEqual} from "node:crypto";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {z} from "zod/v4";
import {readCatalog} from "./catalog-repository.mjs";
import {appendTeamDeckCards,createTeamDeck,finishTeamDeck,reassignTeamDeckCreator,readTeamDeckDrafts} from "./author-repository.mjs";
import {TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH,DESCRIPTION_MAX_LENGTH,EDITORIAL_NOTE_MAX_LENGTH,MAX_CARDS_PER_DECK} from "../app/core.mjs";
import {ApiError} from "./errors.mjs";
import {normalizeQuoteSourceUrl} from "../app/quote-source.mjs";

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
  const server=new McpServer({name:"reedleaves-deck-authoring",version:"1.2.0"},{
    instructions:"Create finished Reedleaves team decks from the user's conversation. Saving publishes and freezes the complete deck in the shared catalog, attributed to Equipo Reedleaves. Prepare all cards before creating. Find a book only when unclear. Use list_team_drafts to identify older team drafts and finish_deck only when the user asks to finish them. Use reassign_deck_creator only when the user explicitly requests changing attribution of a published team deck to an existing account by username. Never invent source quotes or quote-source URLs; use isQuote only for wording supplied by the user and quoteSourceUrl only for a supplied or verified page.",
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
      book.popularTitle,book.author,...Object.values(book.title)
    ].some(value=>value?.toLocaleLowerCase("es").includes(needle))).slice(0,12).map(book=>({
      bookId:book.id,title:book.popularTitle,author:book.author,popularLanguage:book.popularLanguage,
      localizedTitles:book.title,deckCount:catalog.decks.filter(deck=>deck.bookId===book.id).length
    }));
    return toolText({matches});
  }));
  server.registerTool("create_deck",{
    title:"Crear baraja",
    description:"Save a complete finished deck (published) to the shared Reedleaves catalog, attributed to Equipo Reedleaves. Prepare all cards first: creating freezes the deck and prevents further additions. An optional quoteSourceUrl links to the supplied or verified source page for quotes in the deck. The user must have clearly asked to save/create it; saving makes it visible to other catalog users.",
    inputSchema:{
      requestId:z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).describe("Stable UUID for this creation attempt; reuse it if retrying after a timeout."),
      bookId:z.string().min(1).max(240),title:z.string().trim().min(1).max(TITLE_MAX_LENGTH),
      description:z.string().trim().max(DESCRIPTION_MAX_LENGTH).optional(),editorialNote:z.string().trim().min(1).max(EDITORIAL_NOTE_MAX_LENGTH).optional(),
      quoteSourceUrl:z.string().trim().max(2048).refine(value=>normalizeQuoteSourceUrl(value)!==null)
        .optional().describe("Optional HTTPS page used as the source for quotes in this team deck. Only include a supplied or verified URL; this can only be set when creating the deck."),
      language:z.string().min(2).max(35),
      cards:z.array(z.object({title:z.string().trim().max(TITLE_MAX_LENGTH).optional(),body:z.string().trim().min(1).max(CARD_BODY_MAX_LENGTH),
        isQuote:z.boolean().default(false),parentIndex:z.number().int().nonnegative().nullable().optional()})).min(1).max(MAX_CARDS_PER_DECK)
    },
    annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}
  },safeTool(async(input)=>{
    const result=await createTeamDeck(db,input);
    return toolText({...result,url:`${publicBaseUrl.replace(/\/+$/ ,"")}/app/#book/${encodeURIComponent(input.bookId)}`});
  }));
  server.registerTool("append_cards_to_draft",{
    title:"Añadir tarjetas a borrador",
    description:"Append cards to a draft deck created by Equipo Reedleaves. Existing cards cannot be edited or removed by this tool. Saving updates the shared catalog.",
    inputSchema:{requestId:z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).describe("Stable UUID for this append operation; reuse it when retrying."),deckId:z.string().min(1).max(280),
      cards:z.array(z.object({title:z.string().trim().max(TITLE_MAX_LENGTH).optional(),body:z.string().trim().min(1).max(CARD_BODY_MAX_LENGTH),isQuote:z.boolean().default(false),
        parentId:z.string().min(1).optional(),parentIndex:z.number().int().nonnegative().nullable().optional()})).min(1).max(MAX_CARDS_PER_DECK)},
    annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}
  },safeTool(async(input)=>toolText(await appendTeamDeckCards(db,input))));
  server.registerTool("finish_deck",{
    title:"Marcar baraja como terminada",
    description:"Mark a nonempty draft created by Equipo Reedleaves as finished (published). Call only when the user explicitly asks to finish that deck. Finishing freezes its cards and prevents further additions. Decks owned by other users or without an owner are rejected. Repeating this call for an already finished team deck is safe.",
    inputSchema:{deckId:z.string().trim().min(1).max(256).describe("Deck ID of the team deck to finish, as returned by create_deck.")},
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false}
  },safeTool(async(input)=>toolText(await finishTeamDeck(db,input))));
  server.registerTool("list_team_drafts",{
    title:"Listar borradores de barajas del equipo",
    description:"List only drafts owned by Equipo Reedleaves, optionally filtered by book. Returns deck IDs, titles and card counts so the user can identify existing drafts before finishing them. This call does not change any deck.",
    inputSchema:{bookId:z.string().trim().min(1).max(240).optional()},
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  },safeTool(async(input)=>toolText(await readTeamDeckDrafts(db,input))));
  server.registerTool("reassign_deck_creator",{
    title:"Cambiar creador de baraja del equipo",
    description:"Reassign a published deck owned by Equipo Reedleaves to an existing author account by username. This changes visible attribution. Only use when the user explicitly asks for this specific change. It cannot transfer decks already owned by another account.",
    inputSchema:{deckId:z.string().trim().min(1).max(256).describe("ID of the published team deck to reassign."),
      username:z.string().trim().min(1).max(64).describe("Existing Reedleaves username to show as the deck creator.")},
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false}
  },safeTool(async(input)=>toolText(await reassignTeamDeckCreator(db,input))));
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

import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { PROJECT_ROOT } from "./database.mjs";
import { readCatalog, readCardContext, readCardContexts } from "./catalog-repository.mjs";
import {bookTitle,contentText,quoteExcerpt} from "../app/core.mjs";
import {createReaderApi} from "./reader-api.mjs";
import {readSession} from "./auth.mjs";
import {handleMcpRequest} from "./mcp-server.mjs";
import {mascotArt} from "../app/mascot-art.mjs";
import {words} from "../app/i18n.mjs";

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const imageTypes = new Set([".svg", ".ico", ".png", ".jpg", ".webp"]);

// Explicit URLs bypass Safari's previous icon URL; conventional names also cover
// discovery at the origin root and alongside the app document. Keep the allowlist.
const publicFiles = new Map([["/favicon.ico", "/app/assets/brand/favicon.ico"]]);
for (const prefix of ["", "/app"]) {
  for (const name of ["apple-touch-icon-v2.png", "apple-touch-icon.png", "apple-touch-icon-precomposed.png",
    "apple-touch-icon-180x180.png", "apple-touch-icon-180x180-precomposed.png"]) {
    publicFiles.set(`${prefix}/${name}`, "/app/assets/brand/apple-touch-icon.png");
  }
}

// /brand (herramientas y archivo de diseño) solo se sirve en local con SERVE_BRAND=1.
const servedPrefix = process.env.SERVE_BRAND === "1" ? /^\/(app|brand)\// : /^\/app\//;

export function createCatalogServer(db, root = PROJECT_ROOT, options = {}) {
  const readerApi = createReaderApi(db,options);
  const inviteCode = options.inviteCode;
  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Cache-Control", "no-cache");
    const send = (status, body, type = "application/json; charset=utf-8") => {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(type.startsWith("application/json") ? JSON.stringify(body) : body);
      response.writeHead(status, { "Content-Type": type, "Content-Length": bytes.length });
      response.end(request.method === "HEAD" ? undefined : bytes);
    };
    // Browsers asking for an unknown page get the sad sprout; API and asset callers keep the JSON error.
    const notFound = () => {
      if (request.url.startsWith("/api/") || !request.headers.accept?.includes("text/html")) { send(404, { error: "Not found" }); return; }
      const language = /^\s*en/i.test(request.headers["accept-language"] || "") ? "en" : "es", c = words[language];
      send(404, `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reedleaves</title><link rel="stylesheet" href="/app/mascot-art.css"><link rel="stylesheet" href="/app/reader.css"></head><body><main id="main"><section class="loading loading-error loading-not-found">${mascotArt("sprout","",{animation:"sob"})}<h1>${c.pageNotFound}</h1><a class="primary" href="/app/"><img src="/app/assets/icons/navigation/home.svg" width="20" height="20" alt="">${c.home}</a></section></main></body></html>`,"text/html; charset=utf-8");
    };
    try {
      const url = new URL(request.url, "http://localhost");
      const pathname = decodeURIComponent(url.pathname);
      const path = publicFiles.get(pathname) || pathname;
      if (path === "/mcp") { response.setHeader("Cache-Control","no-store"); await handleMcpRequest(request,response,{db,token:options.mcpToken,publicBaseUrl:options.publicBaseUrl}); return; }
      if (await readerApi(request,response,path,send)) return;
      if (!["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        send(405, { error: "Method not allowed" }); return;
      }
      if (path === "/api/health") { await db.prepare("SELECT 1").get(); send(200, { status: "ok" }); return; }
      if (path === "/api/cards/context") {
        const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean);
        if (!ids.length || ids.length > 20) { send(400, { error: "invalidRequest" }); return; }
        const session = await readSession(db,request,options.now?.() || new Date());
        send(200, { schemaVersion:1, ...await readCardContexts(db,ids,session?.user_id) }); return;
      }
      const cardContextMatch = path.match(/^\/api\/cards\/([^/]+)\/context$/);
      if (cardContextMatch) {
        const session = await readSession(db,request,options.now?.() || new Date());
        const context = await readCardContext(db,cardContextMatch[1],session?.user_id);
        if (!context) { send(404, { error: "Not found" }); return; }
        send(200, context); return;
      }
      if (path === "/api/catalog") {
        const session = await readSession(db,request,options.now?.() || new Date());
        // The catalog is large and rarely changes: the browser keeps its copy and revalidates it with the ETag (304 sends no body).
        const bytes = Buffer.from(JSON.stringify(await readCatalog(db,session?.user_id)));
        const etag = `"${createHash("sha1").update(bytes).digest("base64url")}"`;
        response.setHeader("ETag",etag);
        if (request.headers["if-none-match"]?.split(",").some(tag => tag.trim() === etag)) { response.writeHead(304); response.end(); return; }
        send(200, bytes); return;
      }
      if (path === "/" || path === "/app") {
        response.writeHead(302, { Location: "/app/" }); response.end(); return;
      }
      // Never expose the database, seeds, server code, docs, tests, or directory listings.
      if (!servedPrefix.test(path) || path.includes("\0") || path.split("/").includes("..") || /\.test\.mjs$/.test(path)) {
        notFound(); return;
      }
      const relative = path.endsWith("/") ? `${path}index.html` : path;
      const type = types[extname(relative)];
      if (!type) { notFound(); return; }
      if (imageTypes.has(extname(relative)) && url.searchParams.has("content")) response.setHeader("Cache-Control", "no-store");
      const allowed = await realpath(resolve(root, path.split("/")[1]));
      const file = await realpath(resolve(root, `.${relative}`));
      if (!file.startsWith(allowed + sep)) { notFound(); return; }
      if (path.startsWith("/app/")) response.setHeader("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      let bytes = await readFile(file);
      if (["/app/index.html","/app/reader.css","/app/book-list.css","/app/manifest.webmanifest"].includes(relative)) {
        try { bytes = await readFile(resolve(root,"app/generated/image-static",relative.slice("/app/".length))); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
      }
      if (relative === "/app/index.html" && url.searchParams.has("sharedCard")) {
        const language=url.searchParams.get("cardLanguage") === "en" ? "en" : "es";
        const catalog=await readCatalog(db), card=catalog.cards.find(item=>item.id===url.searchParams.get("sharedCard"));
        const book=card && catalog.books.find(item=>item.id===card.bookId);
        if(card && book) {
          const text=card.isQuote || card.isReadingGuide ? quoteExcerpt(contentText(card.body,language,card.language)) : contentText(card.title,language,card.language);
          const escape=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
          const title=escape(text),description=escape(bookTitle(book,language).text);
          bytes=Buffer.from(bytes.toString().replace('<meta property="og:title" content="Reedleaves">',`<meta property="og:title" content="${title}">\n  <meta property="og:description" content="${description}">\n  <meta name="twitter:title" content="${title}">\n  <meta name="twitter:description" content="${description}">`));
        }
      }
      if (imageTypes.has(extname(relative))) {
        const digest = createHash("sha256").update(bytes).digest("hex");
        const versions = url.searchParams.getAll("content");
        if (versions.length) {
          if (versions.length !== 1 || !/^[a-f0-9]{64}$/.test(versions[0])) {
            response.setHeader("Cache-Control", "no-store");
            send(400, { error: "Invalid image version" }); return;
          }
          if (versions[0] !== digest) {
            url.searchParams.set("content", digest);
            response.writeHead(302, { "Cache-Control": "no-store", Location: url.pathname + url.search });
            response.end(); return;
          }
          response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
        const etag = `"${digest}"`;
        response.setHeader("ETag", etag);
        const candidates = (request.headers["if-none-match"] || "").split(",").map(value => value.trim().replace(/^W\//, ""));
        if (candidates.includes("*") || candidates.includes(etag)) {
          response.writeHead(304); response.end(); return;
        }
      }
      if (/^\/app\/fonts\/[^/]+-v[\d.]+\.woff2$/.test(path)) response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      send(200, bytes, type);
    } catch (error) {
      if (error instanceof URIError) { send(400, { error: "Invalid path" }); return; }
      if (["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) { notFound(); return; }
      console.error("Catalog request failed", error);
      send(500, { error: "Catalog unavailable" });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  return server;
}

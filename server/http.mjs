import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { PROJECT_ROOT } from "./database.mjs";
import { readCatalog } from "./catalog-repository.mjs";
import {createReaderApi} from "./reader-api.mjs";
import {readSession} from "./auth.mjs";

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

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
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const path = pathname === "/favicon.ico" ? "/brand/reed/favicon.ico" : pathname;
      if (await readerApi(request,response,path,send)) return;
      if (!["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        send(405, { error: "Method not allowed" }); return;
      }
      if (path === "/api/health") { await db.prepare("SELECT 1").get(); send(200, { status: "ok" }); return; }
      if (path === "/api/catalog") {
        if (inviteCode !== undefined && !await readSession(db,request)) { send(401,{error:"signInRequired"}); return; }
        const session = await readSession(db,request);
        response.setHeader("Cache-Control","no-store");
        send(200, await readCatalog(db,session?.user_id)); return;
      }
      if (path === "/" || path === "/app") {
        response.writeHead(302, { Location: "/app/" }); response.end(); return;
      }
      // Never expose the database, seeds, server code, docs, tests, or directory listings.
      if (!/^\/(app|brand)\//.test(path) || path.includes("\0") || path.split("/").includes("..") || /\.test\.mjs$/.test(path)) {
        send(404, { error: "Not found" }); return;
      }
      const relative = path.endsWith("/") ? `${path}index.html` : path;
      const type = types[extname(relative)];
      if (!type) { send(404, { error: "Not found" }); return; }
      const allowed = await realpath(resolve(root, path.split("/")[1]));
      const file = await realpath(resolve(root, `.${relative}`));
      if (!file.startsWith(allowed + sep)) { send(404, { error: "Not found" }); return; }
      if (path.startsWith("/app/")) response.setHeader("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      send(200, await readFile(file), type);
    } catch (error) {
      if (error instanceof URIError) { send(400, { error: "Invalid path" }); return; }
      if (["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) { send(404, { error: "Not found" }); return; }
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

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTrade } from "./risk-engine.js";
import { getMarketSnapshot } from "./market.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const publicRoot = join(projectRoot, "public");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body is too large");
  }
  return JSON.parse(body || "{}");
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, { ok: true, service: "preflight-agent" });
  }

  if (request.method === "GET" && url.pathname === "/api/market") {
    const market = await getMarketSnapshot(url.searchParams.get("symbol") || "BTCUSDT");
    return sendJson(response, 200, market);
  }

  if (request.method === "POST" && url.pathname === "/api/analyze") {
    const input = await readBody(request);
    const market = await getMarketSnapshot(input.symbol);
    const result = analyzeTrade(input, market);
    return sendJson(response, 200, result);
  }

  return sendJson(response, 404, { error: "API route not found" });
}

async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(publicRoot, safePath);
  if (!filePath.startsWith(publicRoot)) throw new Error("Invalid path");

  const contents = await readFile(filePath);
  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
    "cache-control": "no-cache"
  });
  response.end(contents);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
    } else {
      await serveStatic(response, url.pathname);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (url.pathname.startsWith("/api/")) {
      sendJson(response, 400, { error: message });
    } else {
      sendJson(response, 404, { error: "File not found" });
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Trade Preflight Agent running at http://127.0.0.1:${port}`);
});

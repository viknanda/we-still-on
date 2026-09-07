import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, isHangId } from "./hang-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 47261;
const HOST = process.env.HOST || "0.0.0.0";
const STATS_KEY = process.env.STATS_KEY || "";
const INDEX = path.join(PUBLIC, "index.html");

const store = createStore();
setInterval(() => store.sweep(), 60_000).unref();

function send(res, status, body, headers = {}) {
  const extra = { ...headers };
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    res.writeHead(status, extra);
    res.end(body);
    return;
  }
  extra["Content-Type"] = "application/json; charset=utf-8";
  extra["Cache-Control"] = "no-store";
  extra["X-Content-Type-Options"] = "nosniff";
  res.writeHead(status, extra);
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) {
        reject(new Error("big"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safePublic(urlPath) {
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const abs = path.normalize(path.join(PUBLIC, rel));
  if (!abs.startsWith(PUBLIC + path.sep) && abs !== PUBLIC) return null;
  return abs;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serveIndex(res, req, hangId) {
  fs.readFile(INDEX, "utf8", (err, html) => {
    if (err) {
      send(res, 404, "gone", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "127.0.0.1";
    const origin = `${proto}://${host}`;
    const url = hangId ? `${origin}/h/${hangId}` : origin;
    let title = "we still on?";
    let desc = "tap yes, late, or out. share the link.";
    if (hangId) {
      const view = store.view(hangId);
      if (view?.line) {
        title = view.line;
        desc = "we still on? yes · late · out";
      } else if (view) {
        title = "we still on?";
      }
    }
    const injected = html
      .replaceAll("{{OG_TITLE}}", escapeHtml(title))
      .replaceAll("{{OG_DESC}}", escapeHtml(desc))
      .replaceAll("{{OG_URL}}", escapeHtml(url));
    send(res, 200, injected, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
  });
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "gone", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    const ext = path.extname(filePath);
    send(res, 200, data, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "no-cache",
    });
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/stats") {
    if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) {
      send(res, 404, { error: "gone" });
      return;
    }
    send(res, 200, store.stats());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/hangs") {
    const hang = store.create();
    send(res, 201, { id: hang.id });
    return;
  }

  const one = url.pathname.match(/^\/api\/hangs\/([A-Za-z0-9_-]+)$/);
  if (one && req.method === "GET") {
    if (!isHangId(one[1])) {
      send(res, 404, { error: "gone" });
      return;
    }
    const view = store.view(one[1]);
    if (!view) {
      send(res, 404, { error: "gone" });
      return;
    }
    send(res, 200, view);
    return;
  }

  const tap = url.pathname.match(/^\/api\/hangs\/([A-Za-z0-9_-]+)\/tap$/);
  if (tap && req.method === "POST") {
    if (!isHangId(tap[1])) {
      send(res, 404, { error: "gone" });
      return;
    }
    let payload;
    try {
      const raw = await readBody(req);
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      send(res, 400, { error: "bad" });
      return;
    }
    const result = store.tap(
      tap[1],
      payload.name,
      payload.status,
      payload.line,
    );
    if (result.error === "gone") {
      send(res, 404, { error: "gone" });
      return;
    }
    if (result.error) {
      send(res, 400, { error: result.error });
      return;
    }
    send(res, 200, store.view(tap[1]));
    return;
  }

  send(res, 404, { error: "gone" });
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  } catch {
    send(res, 400, { error: "bad" });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch {
      send(res, 500, { error: "nope" });
    }
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "no", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (url.pathname === "/") {
    serveIndex(res, req, null);
    return;
  }

  const hangPath = url.pathname.match(/^\/h\/([A-Za-z0-9_-]+)$/);
  if (hangPath) {
    serveIndex(res, req, hangPath[1]);
    return;
  }

  const file = safePublic(url.pathname);
  if (!file) {
    send(res, 404, "gone", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }
  serveFile(res, file);
});

server.listen(PORT, HOST, () => {
  console.log(`we-still-on  http://${HOST}:${PORT}`);
});

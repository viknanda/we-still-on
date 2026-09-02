import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, isHangId } from "./hang-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 47261;
const HOST = process.env.HOST || "127.0.0.1";
const COOKIE = "wso";
const YEAR = 60 * 60 * 24 * 365;

const store = createStore();

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function deviceIdFrom(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[COOKIE] && /^[A-Za-z0-9_-]{8,64}$/.test(cookies[COOKIE])) {
    return cookies[COOKIE];
  }
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64url",
  );
}

function send(res, status, body, headers = {}) {
  const extra = { ...headers };
  if (res._did && !extra["Set-Cookie"]) {
    extra["Set-Cookie"] =
      `${COOKIE}=${encodeURIComponent(res._did)}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
  }
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
  const did = res._did;

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
    const view = store.view(one[1], did);
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
    const result = store.tap(tap[1], did, payload.name, payload.status);
    if (result.error === "gone") {
      send(res, 404, { error: "gone" });
      return;
    }
    if (result.error) {
      send(res, 400, { error: result.error });
      return;
    }
    send(res, 200, store.view(tap[1], did));
    return;
  }

  send(res, 404, { error: "gone" });
}

const server = http.createServer(async (req, res) => {
  const did = deviceIdFrom(req);
  res._did = did;

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

  if (url.pathname === "/" || url.pathname.startsWith("/h/")) {
    serveFile(res, path.join(PUBLIC, "index.html"));
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
  console.log("local only. do not deploy.");
});

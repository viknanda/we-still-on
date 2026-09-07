#!/usr/bin/env node
/**
 * Harvest aggregate we-still-on stats → stats/history.jsonl (+ series snapshot)
 * Key from STATS_KEY env or .wso-stats-key (gitignored).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.env.WSO_STATS_URL || "https://we-still-on.fly.dev";
const outDir = path.join(root, "stats");
const outFile = path.join(outDir, "history.jsonl");
const seriesFile = path.join(outDir, "series-latest.json");
const keyFile = path.join(root, ".wso-stats-key");

function loadKey() {
  if (process.env.STATS_KEY?.trim()) return process.env.STATS_KEY.trim();
  if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, "utf8").trim();
  throw new Error("Missing STATS_KEY env or .wso-stats-key file");
}

const key = loadKey();
const q = `key=${encodeURIComponent(key)}`;

const [totalsRes, seriesRes] = await Promise.all([
  fetch(`${base}/api/stats?${q}`, { cache: "no-store" }),
  fetch(`${base}/api/stats/series?${q}`, { cache: "no-store" }),
]);

if (!totalsRes.ok) {
  throw new Error(`stats HTTP ${totalsRes.status}: ${await totalsRes.text()}`);
}
if (!seriesRes.ok) {
  throw new Error(
    `series HTTP ${seriesRes.status}: ${await seriesRes.text()}`,
  );
}

const stats = await totalsRes.json();
const seriesBody = await seriesRes.json();
const row = { at: new Date().toISOString(), ...stats };

fs.mkdirSync(outDir, { recursive: true });
let prev = null;
if (fs.existsSync(outFile)) {
  const lines = fs
    .readFileSync(outFile, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  if (lines.length) prev = JSON.parse(lines[lines.length - 1]);
}
fs.appendFileSync(outFile, JSON.stringify(row) + "\n");
fs.writeFileSync(seriesFile, JSON.stringify(seriesBody, null, 2) + "\n");

const delta = prev
  ? {
      hangsCreated: row.hangsCreated - (prev.hangsCreated ?? 0),
      hangsActivated: row.hangsActivated - (prev.hangsActivated ?? 0),
      taps: row.taps - (prev.taps ?? 0),
    }
  : null;

console.log(
  JSON.stringify(
    { row, delta, hours: seriesBody.series?.length ?? 0 },
    null,
    2,
  ),
);

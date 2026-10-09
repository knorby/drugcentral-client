#!/usr/bin/env node
/**
 * Captures a structural "shape" snapshot of every curated DrugCentral
 * endpoint and compares it to the committed snapshots in tests/shapes/.
 *
 * DrugCentral's OpenAPI declares no response schemas (every 200 is `{}`),
 * so committed shape snapshots are the drift tripwire: when the API grows,
 * loses, or retypes a field, a regenerated capture differs from the
 * committed snapshot and `--check` fails — signaling that the hand-written
 * types in src/types/ need review.
 *
 * Usage:
 *   node scripts/capture-shapes.mjs             # rewrite tests/shapes/*.json
 *   node scripts/capture-shapes.mjs --check     # exit 1 on any drift
 *
 * Environment:
 *   DRUGCENTRAL_BASE_URL — override the API host (default: the App Runner
 *   deployment observed 2026-10-03).
 *
 * Endpoint list lives here (script-owned) alongside the fixture samples in
 * capture-live.mjs; no runtime package surface is added for tooling.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SAMPLES } from "./capture-live.mjs";
import { shapeOf } from "./shape.mjs";

const BASE =
  process.env.DRUGCENTRAL_BASE_URL ??
  "https://uxn2ycvimg.us-east-2.awsapprunner.com";
const SHAPES_DIR = resolve(import.meta.dirname, "../tests/shapes");
const CHECK_ONLY = process.argv.includes("--check");
const PROBE_SPACING_MS = Number(
  process.env.DRUGCENTRAL_PROBE_SPACING_MS ?? 300,
);
const RECORDS_PER_ENDPOINT = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch JSON with small-limit params, retrying transient 5xx twice. */
async function fetchSample(sample) {
  const query = sample.params
    ? `?${new URLSearchParams(
        Object.entries(sample.params).map(([k, v]) => [k, String(v)]),
      )}`
    : `?limit=${RECORDS_PER_ENDPOINT}`;
  const url = `${BASE}${encodeURI(sample.path)}${query}`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
      }
      if (!response.ok) return { rows: [], url }; // no-match 404 = empty
      return { rows: JSON.parse(text), url };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError;
}

async function main() {
  await mkdir(SHAPES_DIR, { recursive: true });
  const failures = [];
  let drift = 0;

  for (const sample of SAMPLES) {
    try {
      const { rows } = await fetchSample(sample);
      const shape = shapeOf(rows);
      const file = resolve(SHAPES_DIR, `${sample.file}.json`);
      const next = `${JSON.stringify(shape, null, 2)}\n`;
      if (CHECK_ONLY) {
        let current;
        try {
          current = await readFile(file, "utf8");
        } catch {
          current = null;
        }
        if (current !== next) {
          drift += 1;
          console.log(`DRIFT: ${sample.file}`);
        }
      } else {
        await writeFile(file, next);
        console.log(`captured: tests/shapes/${sample.file}.json`);
      }
    } catch (error) {
      failures.push(`${sample.file}: ${error.message}`);
      console.error(`FAILED: ${sample.file}: ${error.message}`);
    }
    await sleep(PROBE_SPACING_MS);
  }

  if (drift > 0) {
    console.error(`\n${drift} endpoint(s) drifted from committed shapes`);
  }
  if (failures.length > 0 || drift > 0) process.exitCode = 1;
}

main();

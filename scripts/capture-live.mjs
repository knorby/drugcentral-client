#!/usr/bin/env node
/**
 * Captures curated live DrugCentral API samples into `tests/fixtures/` and
 * snapshots the upstream OpenAPI document. Run with network access:
 *
 *   node scripts/capture-live.mjs --force
 *
 * Refuses to overwrite existing fixtures without `--force`. Transient 5xx /
 * non-JSON responses (observed upstream behavior) are retried twice with
 * backoff. Huge unhonored-limit responses are truncated and their derivation
 * recorded in a sibling `.meta.json`.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../tests/fixtures");
const BASE =
  process.env.DRUGCENTRAL_BASE_URL ??
  "https://uxn2ycvimg.us-east-2.awsapprunner.com";
const FORCE = process.argv.includes("--force");

/** Run only when executed directly (capture-shapes.mjs imports SAMPLES). */
const IS_DIRECT_RUN =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/** Max rows stored in one fixture file (larger responses are truncated). */
const MAX_ROWS = 50;

/** Curated samples: one per resource group plus evidence cases. */
export const SAMPLES = [
  { file: "structures", path: "/structures/id/5391" },
  { file: "structures-list", path: "/structures", params: { limit: 5 } },
  { file: "synonyms", path: "/synonyms/name/ibuprofen", params: { limit: 20 } },
  { file: "id-type", path: "/id_type", params: { limit: 50 } },
  { file: "identifier", path: "/identifier/id/1762385" },
  {
    file: "identifier-rxnorm",
    path: "/identifier/id_type/RXNORM",
    params: { limit: 2 },
    note: "Evidence for the unhonored-limit quirk: upstream ignores the requested limit.",
  },
  { file: "omop-relationship", path: "/omop_relationship", params: { limit: 5 } },
  {
    file: "omop-off-label",
    path: "/omop_relationship/relationship_name/off-label use",
    params: { limit: 5 },
  },
  {
    file: "omop-indication",
    path: "/omop_relationship/relationship_name/indication",
    params: { limit: 5 },
  },
  { file: "faers", path: "/faers/struct_id/2391", params: { limit: 20 } },
  { file: "faers-female", path: "/faers_female/struct_id/2391", params: { limit: 5 } },
  { file: "product", path: "/product", params: { limit: 5 } },
  { file: "product-ndc", path: "/product/ndc_product_code/55111-695" },
  { file: "atc", path: "/atc", params: { limit: 5 } },
  { file: "struct2atc", path: "/struct2atc/atc_code/A01AA01" },
  { file: "struct2obprod", path: "/struct2obprod/struct_id/102" },
  { file: "drug-class", path: "/drug_class", params: { limit: 5 } },
  {
    file: "act-table-full",
    path: "/act_table_full/struct_id/102",
    params: { limit: 5 },
  },
  { file: "target-dictionary", path: "/target_dictionary", params: { limit: 5 } },
  { file: "target-component", path: "/target_component", params: { limit: 5 } },
  { file: "target-go", path: "/target_go", params: { limit: 5 } },
  { file: "target-keyword", path: "/target_keyword", params: { limit: 5 } },
  { file: "target-class", path: "/target_class", params: { limit: 5 } },
  { file: "td2tc", path: "/td2tc", params: { limit: 5 } },
  { file: "tdgo2tc", path: "/tdgo2tc", params: { limit: 5 } },
  { file: "tdkey2tc", path: "/tdkey2tc", params: { limit: 5 } },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET one JSON document, retrying transient 5xx / non-JSON bodies twice. */
async function fetchJson(url, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
      }
      return { data: JSON.parse(text), raw: text };
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  mkdirSync(fixturesDir, { recursive: true });
  const failures = [];

  for (const sample of SAMPLES) {
    const target = resolve(fixturesDir, `${sample.file}.json`);
    if (existsSync(target) && !FORCE) {
      console.log(`skip (exists): ${sample.file}.json`);
      continue;
    }
    const query = sample.params
      ? `?${new URLSearchParams(
          Object.entries(sample.params).map(([k, v]) => [k, String(v)]),
        )}`
      : "";
    const url = `${BASE}${encodeURI(sample.path)}${query}`;
    try {
      const { data, raw } = await fetchJson(url);
      const rows = Array.isArray(data) ? data : [data];
      const truncated = rows.length > MAX_ROWS;
      const stored = truncated ? rows.slice(0, MAX_ROWS) : rows;
      writeJson(target, stored);
      const notes = [];
      if (truncated) {
        notes.push(
          `Upstream returned ${rows.length} rows; fixture truncated to ${MAX_ROWS}.`,
        );
      }
      if (sample.note) {
        notes.push(
          `${sample.note} (requested limit ${sample.params?.limit} returned ${rows.length} rows)`,
        );
      }
      writeJson(resolve(fixturesDir, `${sample.file}.meta.json`), {
        url,
        fetchedAt: new Date().toISOString(),
        rowsReceived: rows.length,
        rowsStored: stored.length,
        ...(notes.length > 0 ? { derived: truncated, note: notes.join(" ") } : {}),
        sha256: createHash("sha256").update(raw).digest("hex"),
      });
      console.log(
        `captured: ${sample.file}.json (${rows.length} rows${truncated ? `, truncated to ${MAX_ROWS}` : ""})`,
      );
    } catch (error) {
      failures.push(`${sample.file}: ${error.message}`);
      console.error(`FAILED: ${sample.file}: ${error.message}`);
    }
  }

  const openapiTarget = resolve(fixturesDir, "openapi.json");
  if (!existsSync(openapiTarget) || FORCE) {
    try {
      const { data, raw } = await fetchJson(`${BASE}/openapi.json`);
      writeJson(openapiTarget, data);
      writeJson(resolve(fixturesDir, "openapi.meta.json"), {
        url: `${BASE}/openapi.json`,
        fetchedAt: new Date().toISOString(),
        apiVersion: `${data?.info?.title ?? "unknown"} ${data?.info?.version ?? "unknown"}`,
        sha256: createHash("sha256").update(raw).digest("hex"),
      });
      console.log("captured: openapi.json + openapi.meta.json");
    } catch (error) {
      failures.push(`openapi: ${error.message}`);
      console.error(`FAILED: openapi: ${error.message}`);
    }
  } else {
    console.log("skip (exists): openapi.json");
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} sample(s) failed`);
    process.exitCode = 1;
  }
}

if (IS_DIRECT_RUN) main();

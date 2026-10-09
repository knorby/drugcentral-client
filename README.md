# @knorby/drugcentral-client

A fully-typed, zero-dependency TypeScript client for the [DrugCentral](https://drugcentral.org) API — universal: Node, React Native, browsers, Bun, and Deno.

Covers every DrugCentral DRS resource group (structures, synonyms, identifier crosswalks, products, ATC, drug classes, OMOP drug–condition relationships, FAERS signals, drug–target activity, and the target metadata cluster) **plus** a guided domain layer that searches, resolves, and assembles provenance-enveloped knowledge without losing the source's semantics.

> **Not medical advice.** This library is a data-access tool. Nothing it returns is medical advice, a clinical decision, a dosing recommendation, or a safety clearance. An empty result means "no rows matched", never "safe". Always consult a qualified clinician about medications.

> **Not affiliated.** This is an unofficial client. It is not maintained by DrugCentral or the University of New Mexico.

> **Host stability.** The default API host is an App Runner deployment observed 2026-10-03 and is **not guaranteed stable**. Treat `baseUrl` as configuration you will eventually override — check the API link on [drugcentral.org](https://drugcentral.org) if requests suddenly fail, and point your app at the current host.

## About DrugCentral — and thank you

[DrugCentral](https://drugcentral.org) is a drug information resource maintained by the University of New Mexico, offering "information on active ingredients, chemical entities, pharmaceutical products, drug mode of action, indications, pharmacologic action" plus drug–target interaction data. This library exists because DrugCentral publishes an open API over that work — **thank you, DrugCentral team**.

If this library is useful to you, go read [drugcentral.org/about](https://drugcentral.org/about) and cite the resource ([DrugCentral: a drug–target interaction resource](https://pubmed.ncbi.nlm.nih.gov/27683582/), Nucleic Acids Research).

### Data license vs. code license — read this before redistributing

- **This client's code** is Apache-2.0.
- **Everything the API returns is DrugCentral's data**, licensed **CC BY-SA 4.0** ([license text](https://creativecommons.org/licenses/by-sa/4.0/)).

If you redistribute or adapt DrugCentral data (bundled copies, derived datasets, AI-grounding corpora), the CC BY-SA 4.0 terms — attribution and share-alike for the data — apply to that data independently of your code's license. Share-alike obligations attach to the data you distribute, not automatically to your whole application's source code. Merely displaying links to drugcentral.org, or fetching data at runtime through this client, is a different delivery choice than bundling data — know which one you are making. This npm package redistributes **no** DrugCentral data. The source repository includes sampled response data in `tests/fixtures/`, covered by CC BY-SA 4.0 rather than the code's Apache-2.0 license; see the [fixture attribution](https://github.com/knorby/drugcentral-client/blob/main/tests/fixtures/README.md).

## Install

```bash
npm install @knorby/drugcentral-client
```

```ts
import { createDrugCentralClient } from "@knorby/drugcentral-client";

const client = createDrugCentralClient();
```

`fetch` is injectable (and defaults to the runtime global — native in Node 18+, React Native, browsers, Bun, Deno):

```ts
const client = createDrugCentralClient({ fetch: myFetch });
```

## Quick start — the guided layer

The guide returns provenance-enveloped results: `{ data, provenance: { source, endpoint, structId?, retrievedAt, sourceVersion } }`. `sourceVersion` is always `null` — the API exposes no version metadata, and the client never invents one.

```ts
const client = createDrugCentralClient();
const { guide } = client;

// 1. Search by name — ambiguity preserved, never auto-collapsed.
const search = await guide.searchStructuresByName("ibuprofen");
for (const candidate of search.data) {
  console.log(candidate.structId, candidate.name, candidate.matchReason);
  // matchReason: "preferred-name" | "synonym"
}

// 2. Resolve an external identifier (RxNorm shown; UNII also supported).
const rxcui = await guide.resolveByRxcui("259453");
const structId = rxcui.data[0]?.structId;

// 3. Drug–condition knowledge — labels stay verbatim upstream vocabulary.
if (structId !== undefined) {
  const indications = await guide.getIndications(structId);
  const offLabel = await guide.getOffLabelUses(structId);
  const cautions = await guide.getContraindications(structId);

  // FAERS signals are disproportionality statistics — NOT incidence rates.
  const signals = await guide.getFaersSignals(structId, {
    population: "all", // "male" | "female" strata also supported
  });
  console.log(signals.data[0]?.llr, signals.data[0]?.population);

  // Full identity view: structure + identifiers + synonyms + ATC + obprod links.
  const profile = await guide.getStructureProfile(structId);
}
```

`resolveIdentifier({ type, value })` validates the vocabulary against a verified list (`RXNORM`, `UNII`, `SNOMEDCT_US`, `DRUGBANK_ID`, MeSH, and others — `KNOWN_IDENTIFIER_TYPES`); unsupported types throw instead of fuzzy-matching. `resolveByNdc` **throws by design**: this API version cannot join NDCs to structures (see [Known upstream gaps](#known-upstream-gaps)).

## Resource namespaces

Complete typed coverage when you need a specific table (`getAll` methods auto-paginate; `exportText` returns raw CSV/TSV where upstream offers it):

| Namespace | Upstream table(s) | Notes |
| --- | --- | --- |
| `client.structures` | `structures` | id/name/inchikey/smiles/cd_id filters; csv/tsv |
| `client.synonyms` | `synonyms` | one name may map to many structures |
| `client.identifiers` | `identifier` | external-vocabulary crosswalk |
| `client.idTypes` | `id_type` | the vocabularies themselves |
| `client.omopRelationships` | `omop_relationship` | see substring warning below |
| `client.faers` | `faers`, `faers_male`, `faers_female` | unified behind `population` |
| `client.products` | `product` | NDC/route/form/marketing status; csv/tsv |
| `client.atc` | `atc` | ATC hierarchy rows |
| `client.drugClasses` | `drug_class` | pharmacologic classes |
| `client.struct2atc`, `client.struct2obprod` | junctions | structure ↔ ATC / Orange Book products |
| `client.targetActivity` | `act_table_full` | drug–**target** activity, **not DDI**; csv/tsv |
| `client.targets` | `target_dictionary`, `target_component`, `target_go`, `target_keyword`, `target_class`, `td2tc`, `tdgo2tc`, `tdkey2tc` | target metadata cluster |
| `client.raw` | any path | `get`/`getText` escape hatch |

## Configuration

```ts
createDrugCentralClient({
  baseUrl: "https://uxn2ycvimg.us-east-2.awsapprunner.com", // default; override when the host changes
  timeoutMs: 30_000,        // per-request timeout (AbortController)
  fetch: globalThis.fetch,  // injectable transport
  headers: {},              // merged case-insensitively
  userAgent: undefined,     // defaults to @knorby/drugcentral-client/<version>
  maxRetries: 0,            // opt-in bounded retry for transient 5xx (250ms·2^n backoff)
});
```

The default host is the App Runner deployment DrugCentral's site linked on 2026-10-03. It is **not** guaranteed stable — if requests fail, check the API link on [drugcentral.org](https://drugcentral.org) and override `baseUrl`.

## Pagination semantics (read this)

List endpoints take `skip`/`limit`. Two verified quirks shape the client's behavior:

1. **Some filtered endpoints ignore `limit`** and stream the entire table (e.g. `/identifier/id_type/RXNORM?limit=2` returns all ~3.5k rows). `getAll` detects a response longer than the requested limit, treats it as a complete single-page dump, and stops — it never loops.
2. **`maxPages` stops are labeled truncation.** An iteration that stopped on `maxPages` found everything up to that point, not everything upstream.

Guided methods that accept `limit` (`searchStructuresByName`, `getConditionRelationships` and its kind wrappers) cap results **client-side** (upstream filtered endpoints ignore `limit`) and mark the envelope with `truncated: true` when capping drops rows — truncation is labeled, never implied complete.

## Errors

Every failure is a `DrugCentralError` subclass: `DrugCentralApiError` (non-2xx; `.status`, `.body`, `.url`), `DrugCentralNotFoundError` (DrugCentral reports **no-match path filters as HTTP 404** — catch this to treat "no rows" as a normal outcome; it never means the data was checked or is safe), `DrugCentralInvalidResponseError` (the observed transient non-JSON bodies), `DrugCentralTimeoutError`, `DrugCentralNetworkError`. Consumer aborts re-throw the original `AbortError` unwrapped.

**No-match contract (pinned in tests — safe to rely on).** Upstream reports no-match path filters as HTTP 404. Resource-level methods surface `DrugCentralNotFoundError`; guided-layer methods that can legitimately see zero rows (`searchStructuresByName`, `resolveIdentifier`/`resolveByRxcui`/`resolveByUnii`, `getConditionRelationships` + kind wrappers, `getFaersSignals`, `getTargetActivity`) normalize no-match to `data: []` with a provenance envelope, and `getStructureProfile` resolves `structure: null` + empty sections — never an error. Empty means "no rows matched", never "safe".

## Capability matrix

| Capability | Method(s) | Status |
| --- | --- | --- |
| Search structures, preserve one-to-many identity | `guide.searchStructuresByName` | ✅ |
| Resolve external identifiers (RxNorm, UNII, …) | `guide.resolveIdentifier`, `resolveByRxcui`, `resolveByUnii` | ✅ |
| Resolve NDCs to structures | `guide.resolveByNdc` | ❌ unsupported upstream (throws, documented) |
| Drug–condition relationships with verbatim labels | `guide.getConditionRelationships`, `getIndications`, `getOffLabelUses`, `getContraindications` | ✅ |
| FAERS signals, population-stratified | `guide.getFaersSignals` | ✅ (3 strata only — see gaps) |
| Classification & descriptions | `guide.getStructureProfile` (ATC), `client.atc`, `client.drugClasses` | ✅ |
| Drug–target activity (≠ DDI) | `guide.getTargetActivity`, `client.targetActivity` | ✅ |
| Provenance on every guided result | `{ data, provenance }` envelope | ✅ (source version: not supplied upstream) |

## Known upstream gaps (verified 2026-10-03)

- **No version endpoint.** `sourceVersion` stays `null`; retrieval timestamps are client-clock metadata.
- **NDC → structure is impossible** on this API version: `product.id` and `struct2obprod.prod_id` are disjoint id spaces and no obprod-by-NDC endpoint exists.
- **Only 3 FAERS strata** (`all`/`male`/`female`) are exposed; the DrugCentral database carries more (geriatric, pediatric, …).
- **`relationship_name` path filters substring-match** upstream (`"indication"` also returns `"contraindication"` rows). The guided layer filters by exact equality client-side; `client.omopRelationships.byRelationshipName` is a verbatim passthrough with this documented trap.
- **Transient non-JSON 5xx bodies** occur; mapped to typed errors, with opt-in bounded retry.
- **Browser CORS is unverified**; React Native is a primary target, web best-effort.

## React Native

Zero runtime dependencies and no Node-only APIs — Metro-safe out of the box. On runtimes without a global `fetch`, inject one via config. The package ships dual ESM/CJS with `.d.ts`/`.d.cts` declarations.

## Development

```bash
npm run lint && npm run typecheck && npm run build && npm test  # build before declaration tests
npm audit --audit-level=moderate
npm run changeset:check  # parse all changesets; no Git base ref needed
npm run pack:check      # dry-run packing; validates contents and ESM/CJS entry points
npm run test:live       # opt-in live smoke tests (DRUGCENTRAL_LIVE_TESTS=1, needs network)
npm run drift:capture   # re-capture upstream response shapes into tests/shapes/
npm run drift:check     # fail when upstream shapes drift from committed snapshots
```

Types are hand-written from sampled live payloads (`tests/fixtures/`, with `openapi.json` snapshotted for reference) because the upstream OpenAPI declares no response schemas. See [AGENTS.md](AGENTS.md) for conventions and the [license notes](#data-license-vs-code-license--read-this-before-redistributing) before redistributing data.

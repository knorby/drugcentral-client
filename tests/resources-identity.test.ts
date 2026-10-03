import { describe, expect, test, vi } from "vitest";
import type { DrugCentralRequester } from "../src/http";
import {
  createIdentifiersResource,
  createIdTypesResource,
  createStructuresResource,
  createSynonymsResource,
} from "../src/resources/identity";

/** Builds a requester mock that records (path, params) pairs. */
function mockRequester() {
  const calls: Array<{ path: string; params?: Record<string, unknown> }> = [];
  const get = vi.fn(async (path: string, params?: Record<string, unknown>) => {
    calls.push({ path, params });
    return [] as unknown[];
  });
  const getText = vi.fn(async (path: string) => {
    calls.push({ path });
    return "csv-body";
  });
  const requester = {
    get,
    getText,
    baseUrl: "https://x.test",
  } as unknown as DrugCentralRequester;
  return { requester, calls };
}

describe("structures resource", () => {
  test("byId hits structures/id/{id}", async () => {
    const { requester, calls } = mockRequester();
    await createStructuresResource(requester).byId(5391);
    expect(calls[0]?.path).toBe("structures/id/5391");
  });

  test("byName percent-encodes spaces and reserved characters", async () => {
    const { requester, calls } = mockRequester();
    await createStructuresResource(requester).byName("ibuprofen sodium");
    expect(calls[0]?.path).toBe("structures/name/ibuprofen%20sodium");
    await createStructuresResource(requester).byName("a/b%c d");
    expect(calls[1]?.path).toBe("structures/name/a%2Fb%25c%20d");
  });

  test("byInchikey / bySmiles / byCdId map to their upstream filters", async () => {
    const { requester, calls } = mockRequester();
    const r = createStructuresResource(requester);
    await r.byInchikey("KUFQUVHVLWBPCX-UHFFFAOYSA-N");
    await r.bySmiles("CC(=O)Oc1ccccc1C(=O)O");
    await r.byCdId(2244);
    expect(calls.map((c) => c.path)).toEqual([
      "structures/inchikey/KUFQUVHVLWBPCX-UHFFFAOYSA-N",
      // `=` is a reserved sub-delim; encodeURIComponent encodes it, which
      // upstream decodes back to the same SMILES string.
      "structures/smiles/CC(%3DO)Oc1ccccc1C(%3DO)O",
      "structures/cd_id/2244",
    ]);
  });

  test("list sends skip/limit query params", async () => {
    const { requester, calls } = mockRequester();
    await createStructuresResource(requester).list({ skip: 10, limit: 5 });
    expect(calls[0]?.path).toBe("structures");
    expect(calls[0]?.params).toEqual({ skip: 10, limit: 5 });
  });

  test("getAll pages via skip/limit", async () => {
    const { requester, calls } = mockRequester();
    const rows: unknown[] = [];
    for await (const row of createStructuresResource(requester).getAll(
      {},
      { pageSize: 2, maxPages: 1 },
    )) {
      rows.push(row);
    }
    expect(calls[0]?.params).toEqual({ skip: 0, limit: 2 });
  });

  test("exportText hits the csv/tsv sibling", async () => {
    const { requester, calls } = mockRequester();
    await createStructuresResource(requester).exportText("csv");
    expect(calls[0]?.path).toBe("structures/csv");
    await createStructuresResource(requester).exportText("tsv");
    expect(calls[1]?.path).toBe("structures/tsv");
  });
});

describe("synonyms resource", () => {
  test("filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createSynonymsResource(requester);
    await r.byId(1407);
    await r.bySynId(2162);
    await r.byName("vitamin c");
    expect(calls.map((c) => c.path)).toEqual([
      "synonyms/id/1407",
      "synonyms/syn_id/2162",
      "synonyms/name/vitamin%20c",
    ]);
  });

  test("exportText hits the csv/tsv sibling", async () => {
    const { requester, calls } = mockRequester();
    await createSynonymsResource(requester).exportText("tsv");
    expect(calls[0]?.path).toBe("synonyms/tsv");
  });
});

describe("identifiers resource", () => {
  test("filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createIdentifiersResource(requester);
    await r.byId(1762385);
    await r.byStructId(102);
    await r.byIdentifier("M9BYU8XDQ6");
    await r.byIdType("RXNORM");
    expect(calls.map((c) => c.path)).toEqual([
      "identifier/id/1762385",
      "identifier/struct_id/102",
      "identifier/identifier/M9BYU8XDQ6",
      "identifier/id_type/RXNORM",
    ]);
  });

  test("has no exportText (no csv/tsv upstream)", () => {
    const { requester } = mockRequester();
    expect("exportText" in createIdentifiersResource(requester)).toBe(false);
  });
});

describe("id types resource", () => {
  test("filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createIdTypesResource(requester);
    await r.byId(36);
    await r.byType("RXNORM");
    await r.list();
    expect(calls.map((c) => c.path)).toEqual([
      "id_type/id/36",
      "id_type/type/RXNORM",
      "id_type",
    ]);
  });
});

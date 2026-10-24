import { describe, expect, test, vi } from "vitest";
import type { DrugCentralRequester } from "../src/http";
import {
  createAtcResource,
  createDrugClassesResource,
  createProductsResource,
  createStruct2AtcResource,
  createStruct2ObprodResource,
} from "../src/resources/classification";

function mockRequester() {
  const calls: Array<{ path: string; params?: Record<string, unknown> }> = [];
  const get = vi.fn(async (path: string, params?: Record<string, unknown>) => {
    calls.push({ path, params });
    return [] as unknown[];
  });
  const getText = vi.fn(async (path: string) => {
    calls.push({ path });
    return "body";
  });
  const requester = {
    get,
    getText,
    baseUrl: "https://x.test",
  } as unknown as DrugCentralRequester;
  return { requester, calls };
}

describe("products resource", () => {
  test("filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createProductsResource(requester);
    await r.byId(2928251);
    await r.byNdcProductCode("55111-695");
    await r.byProductName("GLYBURIDE AND METFORMIN HYDROCHLORIDE");
    await r.byRoute("ORAL");
    await r.list({ limit: 5 });
    expect(calls.map((c) => c.path)).toEqual([
      "product/id/2928251",
      "product/ndc_product_code/55111-695",
      "product/product_name/GLYBURIDE%20AND%20METFORMIN%20HYDROCHLORIDE",
      "product/route/ORAL",
      "product",
    ]);
    expect(calls[4]?.params).toEqual({ limit: 5 });
  });

  test("getAll pages via skip/limit", async () => {
    const { requester, calls } = mockRequester();
    for await (const _row of createProductsResource(requester).getAll(
      undefined,
      { pageSize: 2, maxPages: 1 },
    )) {
      // drain
    }
    expect(calls).toEqual([{ path: "product", params: { skip: 0, limit: 2 } }]);
  });

  test("exportText hits the csv/tsv sibling", async () => {
    const { requester, calls } = mockRequester();
    await createProductsResource(requester).exportText("csv");
    expect(calls[0]?.path).toBe("product/csv");
  });
});

describe("atc resource", () => {
  test("filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createAtcResource(requester);
    await r.byId(1);
    await r.byCode("A01AA01");
    await r.byChemicalSubstance("sodium fluoride");
    expect(calls.map((c) => c.path)).toEqual([
      "atc/id/1",
      "atc/code/A01AA01",
      "atc/chemical_substance/sodium%20fluoride",
    ]);
  });

  test("list and getAll page via skip/limit", async () => {
    const { requester, calls } = mockRequester();
    const r = createAtcResource(requester);
    await r.list({ limit: 5 });
    for await (const _row of r.getAll(undefined, {
      pageSize: 1,
      maxPages: 1,
    })) {
      // drain
    }
    expect(calls).toEqual([
      { path: "atc", params: { limit: 5 } },
      { path: "atc", params: { skip: 0, limit: 1 } },
    ]);
  });

  test("has no exportText (no csv/tsv upstream)", () => {
    const { requester } = mockRequester();
    expect("exportText" in createAtcResource(requester)).toBe(false);
  });
});

describe("drug classes resource", () => {
  test("filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createDrugClassesResource(requester);
    await r.byId(7740);
    await r.byName("Monoamine Oxidase Inhibitors");
    await r.bySource("LEXICOMP");
    expect(calls.map((c) => c.path)).toEqual([
      "drug_class/id/7740",
      "drug_class/name/Monoamine%20Oxidase%20Inhibitors",
      "drug_class/source/LEXICOMP",
    ]);
  });

  test("list and getAll page via skip/limit", async () => {
    const { requester, calls } = mockRequester();
    const r = createDrugClassesResource(requester);
    await r.list();
    for await (const _row of r.getAll(undefined, {
      pageSize: 3,
      maxPages: 1,
    })) {
      // drain
    }
    expect(calls).toEqual([
      { path: "drug_class", params: undefined },
      { path: "drug_class", params: { skip: 0, limit: 3 } },
    ]);
  });
});

describe("struct2atc and struct2obprod resources", () => {
  test("struct2atc filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createStruct2AtcResource(requester);
    await r.byStructId(4243);
    await r.byAtcCode("A01AA01");
    await r.list({ skip: 0 });
    expect(calls.map((c) => c.path)).toEqual([
      "struct2atc/struct_id/4243",
      "struct2atc/atc_code/A01AA01",
      "struct2atc",
    ]);
  });

  test("struct2atc getAll pages via skip/limit", async () => {
    const { requester, calls } = mockRequester();
    for await (const _row of createStruct2AtcResource(requester).getAll(
      undefined,
      { pageSize: 1, maxPages: 1 },
    )) {
      // drain
    }
    expect(calls).toEqual([
      { path: "struct2atc", params: { skip: 0, limit: 1 } },
    ]);
  });

  test("struct2obprod filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createStruct2ObprodResource(requester);
    await r.byStructId(102);
    await r.byProdId(683206);
    expect(calls.map((c) => c.path)).toEqual([
      "struct2obprod/struct_id/102",
      "struct2obprod/prod_id/683206",
    ]);
  });

  test("struct2obprod list and getAll page via skip/limit", async () => {
    const { requester, calls } = mockRequester();
    const r = createStruct2ObprodResource(requester);
    await r.list({ skip: 5, limit: 10 });
    for await (const _row of r.getAll(undefined, {
      pageSize: 2,
      maxPages: 1,
    })) {
      // drain
    }
    expect(calls).toEqual([
      { path: "struct2obprod", params: { skip: 5, limit: 10 } },
      { path: "struct2obprod", params: { skip: 0, limit: 2 } },
    ]);
  });
});

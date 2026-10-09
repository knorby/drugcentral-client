import { describe, expect, test, vi } from "vitest";
import type { DrugCentralRequester } from "../src/http";
import {
  createTargetActivityResource,
  createTargetsResource,
} from "../src/resources/targets";

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

describe("target activity resource (act_table_full)", () => {
  test("filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createTargetActivityResource(requester);
    await r.byStructId(102);
    await r.byActId(187133);
    await r.byAccession("P0AFI2|P20083");
    await r.byActType("IC50");
    await r.byGene("parC|parE");
    await r.byOrganism("Escherichia coli (strain K12)");
    await r.bySwissprot("PARC_ECOLI");
    await r.byTargetClass("Enzyme");
    await r.list({ limit: 5 });
    expect(calls.map((c) => c.path)).toEqual([
      "act_table_full/struct_id/102",
      "act_table_full/act_id/187133",
      "act_table_full/accession/P0AFI2%7CP20083",
      "act_table_full/act_type/IC50",
      "act_table_full/gene/parC%7CparE",
      "act_table_full/organism/Escherichia%20coli%20(strain%20K12)",
      "act_table_full/swissprot/PARC_ECOLI",
      "act_table_full/target_class/Enzyme",
      "act_table_full",
    ]);
  });

  test("exportText hits the csv/tsv sibling", async () => {
    const { requester, calls } = mockRequester();
    await createTargetActivityResource(requester).exportText("tsv");
    expect(calls[0]?.path).toBe("act_table_full/tsv");
  });
});

describe("targets resource cluster", () => {
  test("dictionary filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const { dictionary } = createTargetsResource(requester);
    await dictionary.byId(2749);
    await dictionary.byTargetClass("Enzyme");
    expect(calls.map((c) => c.path)).toEqual([
      "target_dictionary/id/2749",
      "target_dictionary/target_class/Enzyme",
    ]);
    expect("exportText" in dictionary).toBe(false);
  });

  test("component filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const { component } = createTargetsResource(requester);
    await component.byId(2749);
    await component.byAccession("P0AFI2");
    await component.byGene("parC");
    await component.byOrganism("Escherichia coli (strain K12)");
    await component.bySwissprot("PARC_ECOLI");
    expect(calls.map((c) => c.path)).toEqual([
      "target_component/id/2749",
      "target_component/accession/P0AFI2",
      "target_component/gene/parC",
      "target_component/organism/Escherichia%20coli%20(strain%20K12)",
      "target_component/swissprot/PARC_ECOLI",
    ]);
    await component.exportText("csv");
    expect(calls[5]?.path).toBe("target_component/csv");
  });

  test("go / keyword / classes map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const { go, keyword, classes } = createTargetsResource(requester);
    await go.byId("GO:0003824");
    await go.byType("FUNCTION");
    await keyword.byId("1");
    await keyword.byKeyword(" kinase");
    await keyword.byCategory("CATALYTIC");
    await classes.byId(1);
    await classes.byL1("ENZYME");
    expect(calls.map((c) => c.path)).toEqual([
      "target_go/id/GO%3A0003824",
      "target_go/type/FUNCTION",
      "target_keyword/id/1",
      "target_keyword/keyword/%20kinase",
      "target_keyword/category/CATALYTIC",
      "target_class/id/1",
      "target_class/l1/ENZYME",
    ]);
  });

  test("junction tables map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const { td2tc, tdgo2tc, tdkey2tc } = createTargetsResource(requester);
    await td2tc.byTargetId(2749);
    await td2tc.byComponentId(2651);
    await tdgo2tc.byGoId("GO:0003824");
    await tdgo2tc.byComponentId(2651);
    await tdkey2tc.byTdKeyId("1");
    await tdkey2tc.byComponentId(2651);
    expect(calls.map((c) => c.path)).toEqual([
      "td2tc/target_id/2749",
      "td2tc/component_id/2651",
      "tdgo2tc/go_id/GO%3A0003824",
      "tdgo2tc/component_id/2651",
      "tdkey2tc/tdkey_id/1",
      "tdkey2tc/component_id/2651",
    ]);
  });
});

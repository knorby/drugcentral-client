import { describe, expect, test, vi } from "vitest";
import type { DrugCentralRequester } from "../src/http";
import { createFaersResource, createOmopRelationshipsResource } from "../src/resources/knowledge";

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
  const requester = { get, getText, baseUrl: "https://x.test" } as unknown as DrugCentralRequester;
  return { requester, calls };
}

describe("omop relationships resource", () => {
  test("filter methods map to upstream paths", async () => {
    const { requester, calls } = mockRequester();
    const r = createOmopRelationshipsResource(requester);
    await r.byId(174026);
    await r.byStructId(5391);
    await r.byConceptId(40249429);
    await r.byConceptName("Triple negative breast neoplasms");
    await r.byUmlsCui("C3539878");
    await r.bySnomedConceptId(706970001);
    await r.byCuiSemanticType("T191");
    expect(calls.map((c) => c.path)).toEqual([
      "omop_relationship/id/174026",
      "omop_relationship/struct_id/5391",
      "omop_relationship/concept_id/40249429",
      "omop_relationship/concept_name/Triple%20negative%20breast%20neoplasms",
      "omop_relationship/umls_cui/C3539878",
      "omop_relationship/snomed_conceptid/706970001",
      "omop_relationship/cui_semantic_type/T191",
    ]);
  });

  test("byRelationshipName encodes spaces and stays verbatim", async () => {
    const { requester, calls } = mockRequester();
    await createOmopRelationshipsResource(requester).byRelationshipName(
      "off-label use",
    );
    expect(calls[0]?.path).toBe(
      "omop_relationship/relationship_name/off-label%20use",
    );
  });
});

describe("faers resource", () => {
  test("defaults to the unstratified table", async () => {
    const { requester, calls } = mockRequester();
    const r = createFaersResource(requester);
    await r.byStructId(2391);
    await r.byId(13259491);
    await r.byMeddraCode(10000028);
    await r.byMeddraName("5'nucleotidase increased");
    await r.list({ limit: 5 });
    expect(calls.map((c) => c.path)).toEqual([
      "faers/struct_id/2391",
      "faers/id/13259491",
      "faers/meddra_code/10000028",
      // Apostrophe is a legal unencoded sub-delim in a path segment.
      "faers/meddra_name/5'nucleotidase%20increased",
      "faers",
    ]);
  });

  test("population param maps to the male/female strata tables", async () => {
    const { requester, calls } = mockRequester();
    const r = createFaersResource(requester);
    await r.byStructId(2391, { population: "male" });
    await r.byStructId(2391, { population: "female" });
    await r.list({ population: "female", limit: 5 });
    for await (const _row of r.getAll({ population: "male" }, { maxPages: 1 })) {
      break;
    }
    expect(calls.map((c) => c.path)).toEqual([
      "faers_male/struct_id/2391",
      "faers_female/struct_id/2391",
      "faers_female",
      "faers_male",
    ]);
  });

  test("exportText honors the population strata", async () => {
    const { requester, calls } = mockRequester();
    const r = createFaersResource(requester);
    await r.exportText("csv");
    await r.exportText("tsv", { population: "female" });
    expect(calls.map((c) => c.path)).toEqual(["faers/csv", "faers_female/tsv"]);
  });

  test("rejects an unknown population eagerly", () => {
    const { requester } = mockRequester();
    expect(() =>
      createFaersResource(requester).list({
        population: "geriatric" as never,
      }),
    ).toThrow();
  });
});

import { describe, expect, test } from "vitest";
import { createDrugCentralClient } from "../src/index";
import { routingFetch } from "./helpers";

/**
 * CONTRACT (Ritualog depends on this): DrugCentral reports no-match path
 * filters as HTTP 404. Resource-level methods surface
 * `DrugCentralNotFoundError`; every guided method that can legitimately see
 * "no rows" normalizes that to an EMPTY result with provenance — never an
 * error. Empty means "no rows matched", never "safe".
 */

const client = createDrugCentralClient({
  baseUrl: "https://x.test",
  fetch: routingFetch({}).fetch, // every route 404s
});

function expectEmptyWithProvenance(result: {
  data: unknown;
  provenance: { source: string; sourceVersion: null };
}) {
  expect(result.provenance.source).toBe("drugcentral");
  expect(result.provenance.sourceVersion).toBeNull();
  const data = result.data as unknown;
  if (Array.isArray(data)) {
    expect(data).toEqual([]);
  }
}

describe("404 → empty guided contract", () => {
  test("searchStructuresByName resolves []", async () => {
    const result = await client.guide.searchStructuresByName("nope");
    expectEmptyWithProvenance(result);
    expect(result.data).toEqual([]);
  });

  test("resolveIdentifier resolves []", async () => {
    const result = await client.guide.resolveIdentifier({
      type: "UNII",
      value: "ZZZZZZZZZZ",
    });
    expectEmptyWithProvenance(result);
  });

  test("resolveByRxcui / resolveByUnii resolve []", async () => {
    expectEmptyWithProvenance(await client.guide.resolveByRxcui("99999999"));
    expectEmptyWithProvenance(await client.guide.resolveByUnii("ZZZZZZZZZZ"));
  });

  test("getStructureProfile resolves null structure + empty sections", async () => {
    const result = await client.guide.getStructureProfile(999999999);
    expectEmptyWithProvenance(result);
    expect(result.data.structure).toBeNull();
    expect(result.data.identifiers).toEqual([]);
    expect(result.data.synonyms).toEqual([]);
    expect(result.data.obprodLinks).toEqual([]);
    expect(result.data.atc).toEqual([]);
  });

  test("getConditionRelationships and all exact-kind wrappers resolve []", async () => {
    expectEmptyWithProvenance(
      await client.guide.getConditionRelationships(999999999),
    );
    expectEmptyWithProvenance(await client.guide.getIndications(999999999));
    expectEmptyWithProvenance(await client.guide.getOffLabelUses(999999999));
    expectEmptyWithProvenance(
      await client.guide.getContraindications(999999999),
    );
  });

  test("getFaersSignals resolves []", async () => {
    expectEmptyWithProvenance(await client.guide.getFaersSignals(999999999));
  });

  test("getTargetActivity resolves []", async () => {
    expectEmptyWithProvenance(await client.guide.getTargetActivity(999999999));
  });
});

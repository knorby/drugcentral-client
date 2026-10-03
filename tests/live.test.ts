import { describe, expect, test } from "vitest";
import { createDrugCentralClient } from "../src/index";

/**
 * Opt-in live smoke checks against the real DrugCentral API. These NEVER run
 * in deterministic CI: set `DRUGCENTRAL_LIVE_TESTS=1` (or use
 * `npm run test:live`) with network access. Live payloads vary over time, so
 * assertions check shapes and semantics — never exact row counts.
 */
const live = process.env.DRUGCENTRAL_LIVE_TESTS === "1";
const describeLive = describe.skipIf(!live);

const client = createDrugCentralClient(); // default host; override via config

describeLive("live smoke: transport", () => {
  test("root reports ok", async () => {
    const status = await client.raw.get<{ status?: string }>("");
    expect(status.status).toBe("ok");
  });

  test("filtered identifier endpoint ignores limits (documented quirk)", async () => {
    // The base list endpoint honors limit; the id_type FILTER dumps the
    // whole vocabulary table regardless (observed 3525 rows for limit=2).
    const rows = await client.identifiers.byIdType("RXNORM");
    expect(rows.length).toBeGreaterThan(2);
  });
});

describeLive("live smoke: identity", () => {
  test("structures.byId returns the sacituzumab record", async () => {
    const rows = await client.structures.byId(5391);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toContain("sacituzumab");
  });

  test("guided name search preserves ibuprofen ambiguity", async () => {
    const { data } = await client.guide.searchStructuresByName("ibuprofen");
    expect(data.length).toBeGreaterThan(1);
    expect(data.some((c) => c.matchReason === "preferred-name")).toBe(true);
  });

  test("guided RxCUI resolution finds struct 4", async () => {
    const { data } = await client.guide.resolveByRxcui("259453");
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((m) => m.structId === 4)).toBe(true);
  });
});

describeLive("live smoke: knowledge", () => {
  test("condition relationships keep verbatim labels; exact kind filtering", async () => {
    const { data } = await client.guide.getConditionRelationships(5391);
    const labels = new Set(data.map((r) => r.relationship_name));
    expect(labels.size).toBeGreaterThan(0);
    const indications = await client.guide.getIndications(5391);
    expect(
      indications.data.every((r) => r.relationship_name === "indication"),
    ).toBe(true);
  });

  test("FAERS signals stamp the population stratum", async () => {
    const { data } = await client.guide.getFaersSignals(2391);
    expect(data.every((row) => row.population === "all")).toBe(true);
    if (data.length > 0) {
      expect(typeof data[0]?.llr).toBe("number");
    }
  });

  test("FAERS male stratum hits the male table", async () => {
    const { data } = await client.guide.getFaersSignals(2391, {
      population: "male",
    });
    expect(data.every((row) => row.population === "male")).toBe(true);
  });

  test("target activity returns drug–target rows (not DDI)", async () => {
    const { data } = await client.guide.getTargetActivity(102);
    expect(data.every((row) => typeof row.act_id === "number")).toBe(true);
  });

  test("idTypes.list returns the vocabulary registry", async () => {
    const rows = await client.idTypes.list();
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.some((row) => row.type === "RXNORM")).toBe(true);
  });
});

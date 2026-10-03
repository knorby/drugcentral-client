import { describe, expect, test } from "vitest";
import { createDrugCentralClient, DrugCentralError } from "../src/index";
import type { DrugStructure } from "../src/types/structures";
import type { Synonym } from "../src/types/synonyms";
import type { IdentifierRecord } from "../src/types/identifiers";
import { routingFetch } from "./helpers";

const STRUCT_IBUPROFEN: DrugStructure = {
  id: 1407,
  name: "ibuprofen",
} as unknown as DrugStructure;

const SYN_IBUPROFEN_ROWS: Synonym[] = [
  {
    id: 1407,
    name: "ibuprofen",
    lname: "ibuprofen",
    preferred_name: 1,
    syn_id: 2162,
    parent_id: 9,
  },
  {
    id: 3851,
    name: "dexibuprofen",
    lname: "dexibuprofen",
    preferred_name: 1,
    syn_id: 2161,
    parent_id: null,
  },
  {
    id: 1407,
    name: "ibuprofen lysine",
    lname: "ibuprofen lysine",
    preferred_name: null,
    syn_id: 19586,
    parent_id: null,
  },
];

function clientWithRoutes(routes: Record<string, unknown>) {
  const mock = routingFetch(routes);
  const client = createDrugCentralClient({
    baseUrl: "https://x.test",
    fetch: mock.fetch,
  });
  return { client, mock };
}

describe("guide.searchStructuresByName", () => {
  test("preserves ambiguous multi-structure matches", async () => {
    const { client } = clientWithRoutes({
      "structures/name/ibuprofen": [STRUCT_IBUPROFEN],
      "synonyms/name/ibuprofen": SYN_IBUPROFEN_ROWS,
    });
    const { data, provenance } = await client.guide.searchStructuresByName(
      "ibuprofen",
    );
    const structIds = data.map((c) => c.structId);
    // Both 1407 (ibuprofen) and 3851 (dexibuprofen) are distinct matches.
    expect(structIds).toContain(1407);
    expect(structIds).toContain(3851);
    // 1407 appears once — deduped by structId, preferred-name reason wins
    // over its non-preferred "ibuprofen lysine" synonym.
    const for1407 = data.filter((c) => c.structId === 1407);
    expect(for1407).toHaveLength(1);
    expect(for1407[0]?.matchReason).toBe("preferred-name");
    expect(for1407[0]?.name).toBe("ibuprofen");
    // 3851 matched through the synonyms table as its own preferred name.
    const for3851 = data.filter((c) => c.structId === 3851);
    expect(for3851[0]?.matchReason).toBe("preferred-name");
    expect(provenance.source).toBe("drugcentral");
    expect(provenance.sourceVersion).toBeNull();
    expect(new Date(provenance.retrievedAt).toString()).not.toBe(
      "Invalid Date",
    );
  });

  test("returns [] (not an error) when nothing matches", async () => {
    const { client } = clientWithRoutes({});
    const { data } = await client.guide.searchStructuresByName("nope");
    expect(data).toEqual([]);
  });

  test("non-preferred synonym matches surface with the synonym reason", async () => {
    const { client } = clientWithRoutes({
      "structures/name/ibuprofen lysine": [],
      "synonyms/name/ibuprofen lysine": [
        {
          id: 1407,
          name: "ibuprofen lysine",
          lname: "ibuprofen lysine",
          preferred_name: null,
          syn_id: 19586,
          parent_id: null,
        },
      ],
    });
    const { data } = await client.guide.searchStructuresByName(
      "ibuprofen lysine",
    );
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      structId: 1407,
      matchReason: "synonym",
      synonymName: "ibuprofen lysine",
    });
  });
});

describe("guide.resolveIdentifier", () => {
  const RX_ROWS: IdentifierRecord[] = [
    {
      id: 1762385,
      identifier: "259453",
      id_type: "RXNORM",
      struct_id: 4,
      parent_match: null,
    },
  ];

  test("resolves by type+value and preserves match shape", async () => {
    const { client } = clientWithRoutes({
      "identifier/identifier/259453": RX_ROWS,
    });
    const { data } = await client.guide.resolveIdentifier({
      type: "RXNORM",
      value: "259453",
    });
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      structId: 4,
      identifier: "259453",
      idType: "RXNORM",
      matchKind: "identifier",
    });
  });

  test("throws for an unsupported type, naming the supported list", async () => {
    const { client } = clientWithRoutes({});
    await expect(
      client.guide.resolveIdentifier({ type: "NOT_A_TYPE", value: "x" }),
    ).rejects.toBeInstanceOf(DrugCentralError);
    await expect(
      client.guide.resolveIdentifier({ type: "NOT_A_TYPE", value: "x" }),
    ).rejects.toThrow(/RXNORM/);
  });

  test("empty matches are data: [] with provenance, never an error", async () => {
    const { client } = clientWithRoutes({});
    const { data, provenance } = await client.guide.resolveIdentifier({
      type: "UNII",
      value: "ZZZZZZZZZZ",
    });
    expect(data).toEqual([]);
    expect(provenance.endpoint).toContain("identifier/identifier/");
  });

  test("resolveByRxcui / resolveByUnii delegate with the right type", async () => {
    const { client, mock } = clientWithRoutes({
      "identifier/identifier/259453": RX_ROWS,
    });
    await client.guide.resolveByRxcui(259453);
    await client.guide.resolveByUnii("M9BYU8XDQ6");
    expect(mock.urls.some((u) => u.endsWith("/identifier/identifier/259453"))).toBe(
      true,
    );
    expect(
      mock.urls.some((u) => u.endsWith("/identifier/identifier/M9BYU8XDQ6")),
    ).toBe(true);
  });
});

describe("guide.resolveByNdc", () => {
  test("throws as an explicitly unsupported capability (disjoint id spaces)", async () => {
    const client = createDrugCentralClient({
      baseUrl: "https://x.test",
      fetch: routingFetch({}).fetch,
    });
    await expect(client.guide.resolveByNdc("55111-695")).rejects.toThrow(
      /not supported by this DrugCentral API version/,
    );
    await expect(client.guide.resolveByNdc("55111-695")).rejects.toBeInstanceOf(
      DrugCentralError,
    );
  });
});

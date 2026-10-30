import { describe, expect, test } from "vitest";
import { createDrugCentralClient, DrugCentralError } from "../src/index";
import type { IdentifierRecord } from "../src/types/identifiers";
import type { DrugStructure } from "../src/types/structures";
import type { Synonym } from "../src/types/synonyms";
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
    const { data, provenance } =
      await client.guide.searchStructuresByName("ibuprofen");
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
    const { data } =
      await client.guide.searchStructuresByName("ibuprofen lysine");
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      structId: 1407,
      matchReason: "synonym",
      synonymName: "ibuprofen lysine",
    });
  });

  test("a later preferred synonym upgrades an earlier non-preferred match", async () => {
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
        {
          id: 1407,
          name: "ibuprofen",
          lname: "ibuprofen",
          preferred_name: 1,
          syn_id: 2162,
          parent_id: null,
        },
      ],
    });
    const { data } =
      await client.guide.searchStructuresByName("ibuprofen lysine");
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      structId: 1407,
      name: "ibuprofen",
      matchReason: "preferred-name",
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

  const RXCUI_LONG: IdentifierRecord = {
    id: 1916562,
    identifier: "1991302",
    id_type: "RXNORM",
    struct_id: 5267,
    parent_match: null,
  };

  test("resolves by type+value and preserves match shape", async () => {
    const { client } = clientWithRoutes({
      "identifier/identifier/259453": [
        ...RX_ROWS,
        {
          id: 999,
          identifier: "259453",
          id_type: "MMSL",
          struct_id: 999,
          parent_match: null,
        },
      ],
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

  test("does not accept a substring row as an exact match", async () => {
    const { client } = clientWithRoutes({
      "identifier/identifier/199130": [RXCUI_LONG],
    });
    const { data } = await client.guide.resolveByRxcui("199130");
    expect(data).toEqual([]);
  });

  test("matches UNII values case-insensitively without rewriting source spelling", async () => {
    const uniiRow: IdentifierRecord = {
      id: 1901605,
      identifier: "M9BYU8XDQ6",
      id_type: "UNII",
      struct_id: 5267,
      parent_match: null,
    };
    const { client } = clientWithRoutes({
      "identifier/identifier/m9byu8xdq6": [uniiRow],
    });
    const { data } = await client.guide.resolveByUnii("m9byu8xdq6");
    expect(data).toHaveLength(1);
    expect(data[0]?.identifier).toBe("M9BYU8XDQ6");
  });

  test("keeps non-UNII identifier matching case-sensitive", async () => {
    const drugBank: IdentifierRecord = {
      id: 1,
      identifier: "DB00001",
      id_type: "DRUGBANK_ID",
      struct_id: 1,
      parent_match: null,
    };
    const { client } = clientWithRoutes({
      "identifier/identifier/db00001": [drugBank],
      "identifier/identifier/DB00001": [drugBank],
    });
    const miss = await client.guide.resolveIdentifier({
      type: "DRUGBANK_ID",
      value: "db00001",
    });
    const hit = await client.guide.resolveIdentifier({
      type: "DRUGBANK_ID",
      value: "DB00001",
    });
    expect(miss.data).toEqual([]);
    expect(hit.data).toHaveLength(1);
  });

  test("resolves a vocabulary absent from the discovery snapshot", async () => {
    const row: IdentifierRecord = {
      id: 1,
      identifier: "X1",
      id_type: "FUTURE_VOCAB",
      struct_id: 74,
      parent_match: null,
    };
    const { client } = clientWithRoutes({
      "identifier/identifier/X1": [row],
    });
    const { data } = await client.guide.resolveIdentifier({
      type: "FUTURE_VOCAB",
      value: "X1",
    });
    expect(data).toHaveLength(1);
  });

  test("matches vocabulary names case-insensitively", async () => {
    const row: IdentifierRecord = {
      id: 2,
      identifier: "CHEMBL2108724",
      id_type: "ChEMBL_ID",
      struct_id: 5267,
      parent_match: null,
    };
    const { client } = clientWithRoutes({
      "identifier/identifier/CHEMBL2108724": [row],
    });
    const { data } = await client.guide.resolveIdentifier({
      type: "chembl_id",
      value: "CHEMBL2108724",
    });
    expect(data[0]?.idType).toBe("ChEMBL_ID");
  });

  test("supports vocabularies containing spaces", async () => {
    const row: IdentifierRecord = {
      id: 493,
      identifier: "53AXN4NNHX",
      id_type: "INXIGHT DRUGS",
      struct_id: 5267,
      parent_match: null,
    };
    const { client } = clientWithRoutes({
      "identifier/identifier/53AXN4NNHX": [row],
    });
    const { data } = await client.guide.resolveIdentifier({
      type: "INXIGHT DRUGS",
      value: "53AXN4NNHX",
    });
    expect(data).toHaveLength(1);
  });

  test("rejects a blank vocabulary before requesting", async () => {
    const { client, mock } = clientWithRoutes({});
    await expect(
      client.guide.resolveIdentifier({ type: "   ", value: "x" }),
    ).rejects.toBeInstanceOf(DrugCentralError);
    expect(mock.urls).toHaveLength(0);
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
    expect(
      mock.urls.some((u) => u.endsWith("/identifier/identifier/259453")),
    ).toBe(true);
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

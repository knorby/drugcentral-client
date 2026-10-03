import { describe, expect, test } from "vitest";
import { createDrugCentralClient } from "../src/index";
import type { Struct2Atc, Struct2Obprod } from "../src/types/classification";
import type { IdentifierRecord } from "../src/types/identifiers";
import type { Product } from "../src/types/products";
import type { DrugStructure } from "../src/types/structures";
import type { Synonym } from "../src/types/synonyms";
import { routingFetch } from "./helpers";

const STRUCT: DrugStructure = {
  id: 102,
  name: "acetylcysteine",
  cas_reg_no: "616-91-1",
} as unknown as DrugStructure;

const ID_ROWS: IdentifierRecord[] = [
  {
    id: 1,
    identifier: "1854320460",
    id_type: "RXNORM",
    struct_id: 102,
    parent_match: null,
  },
  {
    id: 2,
    identifier: "WYQ7N0BPYC",
    id_type: "UNII",
    struct_id: 102,
    parent_match: null,
  },
];

const SYN_ROWS: Synonym[] = [
  {
    id: 102,
    name: "N-acetylcysteine",
    lname: "n-acetylcysteine",
    preferred_name: null,
    syn_id: 5000,
    parent_id: null,
  },
];

const LINKS: Struct2Obprod[] = [
  { struct_id: 102, prod_id: 683206, strength: "EQ 200MG BASE/VIAL" },
  { struct_id: 102, prod_id: 683207, strength: "EQ 300MG BASE/VIAL" },
];

const PRODUCTS: Record<string, Product[]> = {
  "product/id/683206": [
    {
      id: 683206,
      product_name: "ACETYLCYSTEINE 200MG/VIAL",
      generic_name: "acetylcysteine",
      ndc_product_code: "55111-180",
      route: "INTRAVENOUS",
      form: "INJECTION",
      active_ingredient_count: 1,
      marketing_status: "ANDA",
    },
  ],
  "product/id/683207": [
    {
      id: 683207,
      product_name: "ACETYLCYSTEINE 300MG/VIAL",
      generic_name: "acetylcysteine",
      ndc_product_code: "55111-181",
      route: "INTRAVENOUS",
      form: "INJECTION",
      active_ingredient_count: 1,
      marketing_status: "ANDA",
    },
  ],
};

const S2A: Struct2Atc[] = [{ id: 3908, struct_id: 102, atc_code: "R05CB01" }];

function profileRoutes() {
  return {
    "structures/id/102": [STRUCT],
    "identifier/struct_id/102": ID_ROWS,
    "synonyms/id/102": SYN_ROWS,
    "struct2obprod/struct_id/102": LINKS,
    "struct2atc/struct_id/102": S2A,
    ...PRODUCTS,
  };
}

describe("guide.getStructureProfile", () => {
  test("assembles the full profile across tables", async () => {
    const { client } = {
      client: createDrugCentralClient({
        baseUrl: "https://x.test",
        fetch: routingFetch(profileRoutes()).fetch,
      }),
    };
    const { data, provenance } = await client.guide.getStructureProfile(102);
    expect(data.structure?.id).toBe(102);
    expect(data.structure?.name).toBe("acetylcysteine");
    expect(data.identifiers).toHaveLength(2);
    expect(data.identifiers.map((row) => row.id_type)).toEqual([
      "RXNORM",
      "UNII",
    ]);
    expect(data.synonyms[0]?.name).toBe("N-acetylcysteine");
    // obprod links carry the obprod-space prod_ids and strengths (the
    // product table join is impossible — disjoint id spaces).
    expect(data.obprodLinks.map((l) => l.prod_id)).toEqual([683206, 683207]);
    expect(data.obprodLinks[0]?.strength).toBe("EQ 200MG BASE/VIAL");
    expect(data.atc.map((a) => a.atc_code)).toEqual(["R05CB01"]);
    expect(data.drugClasses).toEqual([]);
    expect(provenance.structId).toBe(102);
    expect(provenance.sourceVersion).toBeNull();
  });

  test("missing structure yields null + empty sections, not an error", async () => {
    const client = createDrugCentralClient({
      baseUrl: "https://x.test",
      fetch: routingFetch({}).fetch,
    });
    const { data, provenance } =
      await client.guide.getStructureProfile(999999999);
    expect(data.structure).toBeNull();
    expect(data.identifiers).toEqual([]);
    expect(data.synonyms).toEqual([]);
    expect(data.obprodLinks).toEqual([]);
    expect(data.atc).toEqual([]);
    expect(data.drugClasses).toEqual([]);
    expect(provenance.structId).toBe(999999999);
  });

  test("a present structure with absent subresources stays partly empty", async () => {
    const client = createDrugCentralClient({
      baseUrl: "https://x.test",
      fetch: routingFetch({ "structures/id/102": [STRUCT] }).fetch,
    });
    const { data } = await client.guide.getStructureProfile(102);
    expect(data.structure?.id).toBe(102);
    expect(data.identifiers).toEqual([]);
    expect(data.obprodLinks).toEqual([]);
  });
});

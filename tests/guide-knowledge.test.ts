import { describe, expect, test } from "vitest";
import { createDrugCentralClient } from "../src/index";
import type { FaersSignal } from "../src/types/faers";
import type { OmopRelationship } from "../src/types/omop";
import type { ActTableFullEntry } from "../src/types/targets";
import { routingFetch } from "./helpers";

const RELATIONSHIPS: OmopRelationship[] = [
  {
    id: 174026,
    struct_id: 5391,
    relationship_name: "indication",
    concept_id: 40249429,
    concept_name: "Triple negative breast neoplasms",
    snomed_full_name: "Triple negative breast neoplasms",
    snomed_conceptid: 706970001,
    umls_cui: "C3539878",
    cui_semantic_type: "T191",
  },
  {
    id: 174100,
    struct_id: 5391,
    relationship_name: "off-label use",
    concept_id: 40249416,
    concept_name: "Coronavirus infection",
    snomed_full_name: "Coronavirus infection",
    snomed_conceptid: 186747009,
    umls_cui: "C0206750",
    cui_semantic_type: "T047",
  },
  {
    id: 174200,
    struct_id: 5391,
    relationship_name: "contraindication",
    concept_id: 40249430,
    concept_name: "Severe hepatic impairment",
    snomed_full_name: null,
    snomed_conceptid: null,
    umls_cui: null,
    cui_semantic_type: null,
  },
];

const FAERS_ROWS: FaersSignal[] = [
  {
    id: 13259491,
    struct_id: 2391,
    meddra_code: 10000028,
    meddra_name: "5'nucleotidase increased",
    level: "PT",
    llr: 16.523,
    llr_threshold: 12.154,
    drug_ae: 3,
    drug_no_ae: 83156,
    no_drug_ae: 3,
    no_drug_no_ae: 111230065,
  },
];

const ACTIVITY: ActTableFullEntry[] = [
  {
    act_id: 187133,
    struct_id: 102,
    target_id: 2749,
    target_name: "Topoisomerase IV",
    target_class: "Enzyme",
    accession: "P0AFI2|P20083",
    swissprot: "PARC_ECOLI|PARE_ECOLI",
    gene: "parC|parE",
    organism: "Escherichia coli (strain K12)",
    tdl: null,
    moa: 1,
    moa_ref_id: null,
    moa_source: "CHEMBL",
    moa_source_url:
      "https://www.ebi.ac.uk/chembl/compound/inspect/CHEMBL1201197",
    act_type: null,
    act_value: null,
    act_unit: null,
    act_ref_id: null,
    act_source: "CHEMBL",
    act_source_url: null,
    act_comment: "Mechanism of Action; CHEMBL2363076; PROTEIN COMPLEX",
    action_type: "INHIBITOR",
    relation: null,
    first_in_class: null,
  },
];

function makeClient(routes: Record<string, unknown>) {
  return createDrugCentralClient({
    baseUrl: "https://x.test",
    fetch: routingFetch(routes).fetch,
  });
}

describe("guide.getConditionRelationships", () => {
  test("returns every relationship verbatim with provenance", async () => {
    const client = makeClient({
      "omop_relationship/struct_id/5391": RELATIONSHIPS,
    });
    const { data, provenance } =
      await client.guide.getConditionRelationships(5391);
    expect(data).toHaveLength(3);
    expect(new Set(data.map((r) => r.relationship_name))).toEqual(
      new Set(["indication", "off-label use", "contraindication"]),
    );
    expect(provenance.structId).toBe(5391);
  });

  test("kinds filters by exact label equality (never substring)", async () => {
    const client = makeClient({
      "omop_relationship/struct_id/5391": RELATIONSHIPS,
    });
    const { data } = await client.guide.getConditionRelationships(5391, {
      kinds: ["indication"],
    });
    // "contraindication" must NOT leak into an "indication" kind filter —
    // the upstream relationship_name endpoint would substring-match it.
    expect(data).toHaveLength(1);
    expect(data[0]?.relationship_name).toBe("indication");
    // Untouched records keep their verbatim labels.
    expect(RELATIONSHIPS[1]?.relationship_name).toBe("off-label use");
  });

  test("convenience filters delegate to exact kinds", async () => {
    const client = makeClient({
      "omop_relationship/struct_id/5391": RELATIONSHIPS,
    });
    expect(
      (await client.guide.getIndications(5391)).data.map(
        (r) => r.relationship_name,
      ),
    ).toEqual(["indication"]);
    expect(
      (await client.guide.getOffLabelUses(5391)).data.map(
        (r) => r.relationship_name,
      ),
    ).toEqual(["off-label use"]);
    expect(
      (await client.guide.getContraindications(5391)).data.map(
        (r) => r.relationship_name,
      ),
    ).toEqual(["contraindication"]);
  });

  test("unknown structure yields [] without error", async () => {
    const client = makeClient({});
    const { data } = await client.guide.getConditionRelationships(999999999);
    expect(data).toEqual([]);
  });
});

describe("guide.getFaersSignals", () => {
  test("stamps population 'all' by default and keeps measures verbatim", async () => {
    const client = makeClient({ "faers/struct_id/2391": FAERS_ROWS });
    const { data, provenance } = await client.guide.getFaersSignals(2391);
    expect(data).toHaveLength(1);
    expect(data[0]?.population).toBe("all");
    expect(data[0]?.llr).toBe(16.523);
    expect(data[0]?.drug_ae).toBe(3);
    expect(data[0]?.no_drug_no_ae).toBe(111230065);
    expect(provenance.endpoint).toContain("faers");
  });

  test("population variants hit the strata tables and stamp themselves", async () => {
    const mock = routingFetch({
      "faers_male/struct_id/2391": FAERS_ROWS,
    });
    const client = createDrugCentralClient({
      baseUrl: "https://x.test",
      fetch: mock.fetch,
    });
    const { data } = await client.guide.getFaersSignals(2391, {
      population: "male",
    });
    expect(data[0]?.population).toBe("male");
    expect(mock.urls[0]).toContain("/faers_male/struct_id/2391");
  });

  test("no signals is [] — absence is not zero risk", async () => {
    const client = makeClient({});
    const { data } = await client.guide.getFaersSignals(2391);
    expect(data).toEqual([]);
  });
});

describe("guide.getTargetActivity", () => {
  test("returns typed drug-target activity (not DDI)", async () => {
    const client = makeClient({
      "act_table_full/struct_id/102": ACTIVITY,
    });
    const { data, provenance } = await client.guide.getTargetActivity(102);
    expect(data).toHaveLength(1);
    expect(data[0]?.target_name).toBe("Topoisomerase IV");
    expect(data[0]?.action_type).toBe("INHIBITOR");
    expect(provenance.endpoint).toContain("act_table_full");
  });

  test("no activity rows is []", async () => {
    const client = makeClient({});
    const { data } = await client.guide.getTargetActivity(102);
    expect(data).toEqual([]);
  });
});

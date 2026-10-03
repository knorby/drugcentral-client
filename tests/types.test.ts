import { describe, expect, test } from "vitest";
import type {
  ActTableFullEntry,
  AtcCode,
  DrugClass,
  DrugStructure,
  FaersSignal,
  IdentifierRecord,
  IdType,
  OmopRelationship,
  Product,
  Struct2Atc,
  Struct2Obprod,
  Synonym,
  TargetClass,
  TargetComponent,
  TargetDictionary,
  TargetGo,
  TargetKeyword,
  Td2Tc,
  Tdgo2Tc,
  Tdkey2Tc,
} from "../src/types";
// Typed assignments (not casts): `npm run typecheck` fails if a fixture
// drifts from the declared shapes. Runtime assertions below pin values.
import actTableFullJson from "./fixtures/act-table-full.json";
import atcJson from "./fixtures/atc.json";
import drugClassJson from "./fixtures/drug-class.json";
import faersJson from "./fixtures/faers.json";
import faersFemaleJson from "./fixtures/faers-female.json";
import idTypeJson from "./fixtures/id-type.json";
import identifierJson from "./fixtures/identifier.json";
import identifierRxnormJson from "./fixtures/identifier-rxnorm.json";
import omopIndicationJson from "./fixtures/omop-indication.json";
import omopOffLabelJson from "./fixtures/omop-off-label.json";
import omopRelationshipJson from "./fixtures/omop-relationship.json";
import productJson from "./fixtures/product.json";
import productNdcJson from "./fixtures/product-ndc.json";
import struct2atcJson from "./fixtures/struct2atc.json";
import struct2obprodJson from "./fixtures/struct2obprod.json";
import structuresJson from "./fixtures/structures.json";
import structuresListJson from "./fixtures/structures-list.json";
import synonymsJson from "./fixtures/synonyms.json";
import targetClassJson from "./fixtures/target-class.json";
import targetComponentJson from "./fixtures/target-component.json";
import targetDictionaryJson from "./fixtures/target-dictionary.json";
import targetGoJson from "./fixtures/target-go.json";
import targetKeywordJson from "./fixtures/target-keyword.json";
import td2tcJson from "./fixtures/td2tc.json";
import tdgo2tcJson from "./fixtures/tdgo2tc.json";
import tdkey2tcJson from "./fixtures/tdkey2tc.json";

const actTableFull: ActTableFullEntry[] = actTableFullJson;
const atcRows: AtcCode[] = atcJson;
const classes: DrugClass[] = drugClassJson;
const faersRows: FaersSignal[] = faersJson;
const faersFemaleRows: FaersSignal[] = faersFemaleJson;
const idTypeRows: IdType[] = idTypeJson;
const identifierRows: IdentifierRecord[] = identifierJson;
const identifierRxnormRows: IdentifierRecord[] = identifierRxnormJson;
const omopOffLabelRows: OmopRelationship[] = omopOffLabelJson;
const omopIndicationRows: OmopRelationship[] = omopIndicationJson;
const omopRelationshipRows: OmopRelationship[] = omopRelationshipJson;
const productList: Product[] = productJson;
const productNdcRows: Product[] = productNdcJson;
const struct2atcRows: Struct2Atc[] = struct2atcJson;
const struct2obprodRows: Struct2Obprod[] = struct2obprodJson;
const structuresRows: DrugStructure[] = structuresJson;
const structuresListRows: DrugStructure[] = structuresListJson;
const synonymRows: Synonym[] = synonymsJson;
const targetClassRows: TargetClass[] = targetClassJson;
const targetComponentRows: TargetComponent[] = targetComponentJson;
const targetDictionaryRows: TargetDictionary[] = targetDictionaryJson;
const targetGoRows: TargetGo[] = targetGoJson;
const targetKeywordRows: TargetKeyword[] = targetKeywordJson;
const td2tcRows: Td2Tc[] = td2tcJson;
const tdgo2tcRows: Tdgo2Tc[] = tdgo2tcJson;
const tdkey2tcRows: Tdkey2Tc[] = tdkey2tcJson;

describe("fixtures satisfy the declared types", () => {
  test("structures (single-record and list samples)", () => {
    const single = structuresRows;
    const list = structuresListRows;
    expect(single.length + list.length).toBeGreaterThan(0);
  });

  test("synonyms", () => {
    const rows = synonymRows;
    expect(rows.length).toBeGreaterThan(0);
    expect(typeof rows[0]?.name).toBe("string");
  });

  test("identifier records (by-id and by-type samples)", () => {
    const byId = identifierRows;
    const byType = identifierRxnormRows;
    expect(byId.length + byType.length).toBeGreaterThan(0);
    expect(byType[0]?.id_type).toBe("RXNORM");
  });

  test("id types carry optional resolver URLs", () => {
    const rows = idTypeRows;
    expect(rows.length).toBeGreaterThan(0);
    const withUrl = rows.find((row) => row.url !== null);
    const withoutUrl = rows.find((row) => row.url === null);
    expect(withUrl).toBeDefined();
    expect(withoutUrl).toBeDefined();
  });

  test("products (list and by-ndc samples)", () => {
    const list = productList;
    const byNdc = productNdcRows;
    expect(byNdc[0]?.ndc_product_code).toBe("55111-695");
    expect(list.length).toBeGreaterThan(0);
  });

  test("atc, drug classes, struct2atc, struct2obprod", () => {
    const s2a = struct2atcRows;
    const s2o = struct2obprodRows;
    expect(atcRows[0]?.l1_name).toBe("ALIMENTARY TRACT AND METABOLISM");
    expect(classes.length + s2a.length + s2o.length).toBeGreaterThan(0);
  });

  test("omop relationships preserve the verbatim relationship vocabulary", () => {
    const offLabel = omopOffLabelRows;
    const indication = omopIndicationRows;
    expect(
      offLabel.every((row) => row.relationship_name === "off-label use"),
    ).toBe(true);
    // Evidence fixture: the upstream relationship_name filter is a SUBSTRING
    // match — filtering by "indication" also returns "contraindication" rows
    // (verified live 2026-10-03). Exact-kind filtering is client-side.
    expect(
      indication.some((row) => row.relationship_name === "indication"),
    ).toBe(true);
    expect(
      indication.some((row) => row.relationship_name === "contraindication"),
    ).toBe(true);
    expect(omopRelationshipRows.length).toBeGreaterThan(0);
  });

  test("faers signals keep every contingency-table measure", () => {
    const rows = faersRows;
    const female = faersFemaleRows;
    const row = rows[0];
    expect(row?.meddra_code).toBe(10000028);
    expect(row?.meddra_name).toBe("5'nucleotidase increased");
    expect(row?.level).toBe("PT");
    expect(row?.llr).toBe(16.523);
    expect(row?.llr_threshold).toBe(12.154);
    expect(row?.drug_ae).toBe(3);
    expect(row?.drug_no_ae).toBe(83156);
    expect(row?.no_drug_ae).toBe(3);
    expect(row?.no_drug_no_ae).toBe(111230065);
    expect(female.length).toBeGreaterThan(0);
  });

  test("drug-target activity entries", () => {
    const rows = actTableFull;
    const row = rows[0];
    expect(row?.struct_id).toBe(102);
    expect(row?.target_name).toBe("Topoisomerase IV");
    expect(row?.action_type).toBe("INHIBITOR");
    expect(row?.moa).toBe(1);
  });

  test("target cluster records", () => {
    const dictionary = targetDictionaryRows;
    const component = targetComponentRows;
    const go = targetGoRows;
    const keyword = targetKeywordRows;
    const classes = targetClassRows;
    expect(dictionary.length).toBeGreaterThan(0);
    expect(component.length).toBeGreaterThan(0);
    expect(go.length).toBeGreaterThan(0);
    expect(keyword.length).toBeGreaterThan(0);
    expect(classes.length).toBeGreaterThan(0);
    expect(td2tcRows.length).toBeGreaterThan(0);
    expect(tdgo2tcRows.length).toBeGreaterThan(0);
    expect(tdkey2tcRows.length).toBeGreaterThan(0);
  });
});

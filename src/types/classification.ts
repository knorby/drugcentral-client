/**
 * An ATC classification row (`atc` table): one ATC code with its five-level
 * hierarchy (anatomical main group → chemical/therapeutic/pharmacological
 * subgroup → chemical substance).
 */
export interface AtcCode {
  /** ATC row id. */
  id: number;
  /** Full ATC code (e.g. `"A01AA01"`). */
  code: string | null;
  /** Level-1 (anatomical main group) code and name. */
  l1_code: string | null;
  l1_name: string | null;
  /** Level-2 (therapeutic subgroup) code and name. */
  l2_code: string | null;
  l2_name: string | null;
  /** Level-3 (pharmacological subgroup) code and name. */
  l3_code: string | null;
  l3_name: string | null;
  /** Level-4 (chemical subgroup) code and name. */
  l4_code: string | null;
  l4_name: string | null;
  /** Chemical substance name classified under this code. */
  chemical_substance: string | null;
  /** Number of chemical substances under this code, when supplied. */
  chemical_substance_count: number | null;
}

/**
 * A DrugCentral drug class row (`drug_class` table): a pharmacologic class
 * grouping (e.g. `"Monoamine Oxidase Inhibitors"`, source `"LEXICOMP"`).
 */
export interface DrugClass {
  /** Class row id. */
  id: number;
  /** Class name. */
  name: string | null;
  /** Vocabulary source (e.g. `"LEXICOMP"`, `"FDA"`). */
  source: string | null;
  /** `1` when the row marks a class group rather than a class member. */
  is_group: number | null;
}

/**
 * Structure ↔ ATC assignment (`struct2atc` table).
 */
export interface Struct2Atc {
  /** Row id. */
  id: number;
  /** DrugCentral structure id. */
  struct_id: number;
  /** Assigned ATC code (see {@link AtcCode}). */
  atc_code: string | null;
}

/**
 * Structure ↔ Orange Book product link (`struct2obprod` table): which active
 * ingredient appears in which marketed product, with strength when supplied.
 * Strength context here is per-record and frequently `null` — absent stays
 * absent.
 */
export interface Struct2Obprod {
  /** DrugCentral structure id. */
  struct_id: number;
  /** Product row id (see {@link Product}). */
  prod_id: number;
  /** Strength expression (e.g. `"EQ 200MG BASE/VIAL"`), when supplied. */
  strength: string | null;
}

/**
 * A DrugCentral active-ingredient **structure** record (the `structures`
 * table): the chemical/biologic identity, distinct from marketed products.
 *
 * Physicochemical descriptors (`clogp`, `alogs`, `tpsa`, …) are computed
 * properties that DrugCentral only fills for small molecules; for biologics
 * they are `null`. `null` means "not supplied", never "zero".
 */
export interface DrugStructure {
  /** DrugCentral internal structure id (used by most other tables). */
  id: number;
  /** Preferred name (e.g. `"sacituzumab govitecan-hziy"`). */
  name: string | null;
  /** CAS Registry Number, when assigned. */
  cas_reg_no: string | null;
  /** Free-text DrugCentral definition/description (MeSH-derived). */
  mrdef: string | null;
  /** Drug status flag (e.g. FDA approval status) when supplied. */
  status: string | null;
  /** USAN name stem (e.g. `"-zumab"`), when applicable. */
  stem: string | null;
  /** Number of formulations, when supplied. */
  no_formulations: number | null;
  /** FDA label set identifier(s), when supplied. */
  fda_labels: number[] | string | null;
  /** PubChem-compatible structure identifiers. */
  cd_id: number | null;
  cd_formula: string | null;
  cd_molweight: number | null;
  smiles: string | null;
  inchi: string | null;
  inchikey: string | null;
  molfile: string | null;
  /** Computed physicochemical descriptors (small molecules only). */
  clogp: number | null;
  alogs: number | null;
  tpsa: number | null;
  rotb: number | null;
  sp_c: number | null;
  sp2_c: number | null;
  sp3_c: number | null;
  hetero_sp2_c: number | null;
  o_n: number | null;
  oh_nh: number | null;
  halogen: number | null;
  arom_c: number | null;
  /** Lipinski rule-of-five violations, when computed. */
  lipinski: number | null;
  /** Whether the structure has enhanced stereochemistry. */
  enhanced_stereo: boolean | null;
  /** Rendering color hint from DrugCentral (numeric or `#rrggbb`). */
  rgb: number | string | null;
}

/**
 * A drug-target activity row (`act_table_full` table): reported interaction
 * activity between a structure and a biological target, with mechanism-of-
 * action flags and literature/source provenance.
 *
 * **This is drug–TARGET data, not drug–DRUG interaction data.** DrugCentral's
 * activity tables describe what a compound does to a protein; they contain no
 * pairwise DDI semantics. Do not present these rows as interaction warnings
 * between medications.
 */
export interface ActTableFullEntry {
  /** Activity row id. */
  act_id: number;
  /** DrugCentral structure id. */
  struct_id: number;
  /** Target dictionary id. */
  target_id: number;
  /** Target name (e.g. `"Topoisomerase IV"`). */
  target_name: string | null;
  /** Target class label (e.g. `"Enzyme"`). */
  target_class: string | null;
  /** UniProt accessions, `|`-joined for complexes. */
  accession: string | null;
  /** Swiss-Prot entry names, `|`-joined for complexes. */
  swissprot: string | null;
  /** Gene symbol(s), `|`-joined for complexes. */
  gene: string | null;
  /** Organism the activity was measured in. */
  organism: string | null;
  /** Target development level, when supplied. */
  tdl: string | null;
  /** `1` when this row asserts a mechanism of action. */
  moa: number | null;
  /** MoA reference id, when supplied. */
  moa_ref_id: number | null;
  /** Vocabulary source of the MoA assertion (e.g. `"CHEMBL"`). */
  moa_source: string | null;
  /** Source URL for the MoA assertion. */
  moa_source_url: string | null;
  /** Activity type (e.g. `"IC50"`), when supplied. */
  act_type: string | null;
  /** Activity value, when supplied. */
  act_value: string | number | null;
  /** Activity unit, when supplied. */
  act_unit: string | null;
  /** Activity reference id, when supplied. */
  act_ref_id: number | null;
  /** Vocabulary source of the activity measurement. */
  act_source: string | null;
  /** Source URL for the activity measurement. */
  act_source_url: string | null;
  /** Free-text comment from the source. */
  act_comment: string | null;
  /** Verbatim action label (e.g. `"INHIBITOR"`). */
  action_type: string | null;
  /** Relation qualifier for the activity, when supplied. */
  relation: string | null;
  /** Whether the drug is first-in-class for this target, when supplied. */
  first_in_class: number | string | null;
}

/** A target dictionary row (`target_dictionary` table). */
export interface TargetDictionary {
  id: number;
  name: string | null;
  /** Protein type label (e.g. single-chain vs complex). */
  protein_type: string | null;
  /** Number of protein components (1 for single chains, >1 for complexes). */
  protein_components: number | null;
  /** Target class label. */
  target_class: string | null;
  /** Target development level. */
  tdl: string | null;
}

/** A target component row (`target_component` table): one protein chain. */
export interface TargetComponent {
  id: number;
  name: string | null;
  /** UniProt accession. */
  accession: string | null;
  /** Swiss-Prot entry name. */
  swissprot: string | null;
  /** Gene symbol. */
  gene: string | null;
  /** Entrez gene id. */
  geneid: number | null;
  /** Source organism. */
  organism: string | null;
  /** Target development level. */
  tdl: string | null;
}

/** A Gene Ontology annotation row (`target_go` table). */
export interface TargetGo {
  /** GO row id (supplied as a string upstream). */
  id: string;
  /** GO term label. */
  term: string | null;
  /** GO evidence/category type. */
  type: string | null;
}

/** A target keyword row (`target_keyword` table). */
export interface TargetKeyword {
  /** Keyword row id (supplied as a string upstream). */
  id: string;
  /** Keyword text. */
  keyword: string | null;
  /** Keyword category. */
  category: string | null;
  /** Keyword description. */
  descr: string | null;
}

/** A target class row (`target_class` table): the level-1 class taxonomy. */
export interface TargetClass {
  id: number;
  /** Level-1 class label (e.g. `"ENZYME"`, `"GPCR"`). */
  l1: string | null;
}

/** Target dictionary ↔ target component link (`td2tc` table). */
export interface Td2Tc {
  target_id: number;
  component_id: number;
}

/** Target GO ↔ target component link (`tdgo2tc` table). */
export interface Tdgo2Tc {
  id: number;
  /** GO row id (supplied as a string upstream). */
  go_id: string;
  component_id: number;
}

/** Target keyword ↔ target component link (`tdkey2tc` table). */
export interface Tdkey2Tc {
  id: number;
  /** Keyword row id (supplied as a string upstream). */
  tdkey_id: string;
  component_id: number;
}

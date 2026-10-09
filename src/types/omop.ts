/**
 * A drug–condition relationship row (`omop_relationship` table): DrugCentral's
 * OMOP-mapped assertions linking a structure to a condition concept, with the
 * **verbatim** source relationship label.
 *
 * Semantics worth preserving (verified live 2026-10-03):
 * - `relationship_name` is the source's vocabulary (`"indication"`,
 *   `"contraindication"`, `"off-label use"`, …). Never relabel, never infer
 *   approval status from inclusion.
 * - These are condition-level assertions. They do not carry patient
 *   predicates, route/strength applicability, severity, or management.
 * - A condition-only contraindication is exactly that — not a complete
 *   clinical rule.
 */
export interface OmopRelationship {
  /** Relationship row id. */
  id: number;
  /** DrugCentral structure id (subject of the relationship). */
  struct_id: number;
  /** Verbatim relationship label from the source vocabulary. */
  relationship_name: string;
  /** OMOP condition concept id. */
  concept_id: number;
  /** OMOP condition concept name. */
  concept_name: string | null;
  /** SNOMED CT full name for the condition, when mapped. */
  snomed_full_name: string | null;
  /** SNOMED CT concept id for the condition, when mapped. */
  snomed_conceptid: number | string | null;
  /** UMLS CUI for the condition, when mapped. */
  umls_cui: string | null;
  /** UMLS semantic type of the concept (e.g. `"T047"`). */
  cui_semantic_type: string | null;
}

/**
 * Relationship labels verified in the live vocabulary on 2026-10-03. The
 * upstream vocabulary is not guaranteed exhaustive — always treat
 * {@link OmopRelationship.relationship_name} as the source of truth.
 */
export const KNOWN_RELATIONSHIP_NAMES = [
  "indication",
  "contraindication",
  "off-label use",
] as const;

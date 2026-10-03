/**
 * A DrugCentral identifier crosswalk row (`identifier` table): maps one
 * external-vocabulary identifier to a DrugCentral `struct_id`.
 */
export interface IdentifierRecord {
  /** Identifier row id. */
  id: number;
  /** The external identifier value, as a string (RxCUIs are numeric). */
  identifier: string;
  /** The external vocabulary (see {@link IdType.type}), e.g. `"RXNORM"`. */
  id_type: string;
  /** The DrugCentral structure id this identifier resolves to. */
  struct_id: number;
  /**
   * Parent-identifier link: `true` when this row is a parent/salt match,
   * a parent identifier row id when a specific link exists, else `null`.
   */
  parent_match: number | boolean | null;
}

/**
 * An identifier vocabulary known to DrugCentral (`id_type` table).
 * The set is discoverable at runtime via `client.idTypes.list()`.
 */
export interface IdType {
  /** Vocabulary row id. */
  id: number;
  /** Vocabulary short code, e.g. `"RXNORM"`, `"UNII"`, `"DRUGBANK_ID"`. */
  type: string;
  /** Human description of the vocabulary. */
  description: string;
  /** Resolver URL prefix for looking identifiers up externally, when known. */
  url: string | null;
}

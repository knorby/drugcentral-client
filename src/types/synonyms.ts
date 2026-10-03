/**
 * A DrugCentral synonym row (`synonyms` table): one name variant for one
 * structure. A structure may have many synonyms; a name may map to many
 * structures — ambiguity is real data, never auto-collapsed.
 */
export interface Synonym {
  /** Structure id the synonym belongs to. */
  id: number;
  /** The synonym text. */
  name: string;
  /** Lowercased form of {@link name}. */
  lname: string;
  /** `1` when this synonym is the structure's preferred name, else `null`. */
  preferred_name: number | null;
  /** Synonym row id. */
  syn_id: number;
  /** Parent synonym id for relational synonyms, else `null`. */
  parent_id: number | null;
}

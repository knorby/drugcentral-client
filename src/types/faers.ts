/**
 * A FAERS adverse-event **signal** row (`faers` / `faers_male` /
 * `faers_female` tables): DrugCentral's EBGM-style disproportionality
 * analysis per MedDRA preferred term.
 *
 * These are **report-contingency statistics, not incidence rates**. The four
 * count fields are the 2×2 table cells for the drug × event pair;
 * `llr` vs `llr_threshold` is the signal test. Never present these as the
 * probability a patient experiences the event, and never infer causality.
 */
export interface FaersSignal {
  /** FAERS row id. */
  id: number;
  /** DrugCentral structure id. */
  struct_id: number;
  /** MedDRA code for the event term. */
  meddra_code: number | null;
  /** MedDRA name for the event term (e.g. `"5'nucleotidase increased"`). */
  meddra_name: string | null;
  /** MedDRA hierarchy level of the term (e.g. `"PT"`). */
  level: string | null;
  /** Log-likelihood ratio of the disproportionality signal, when computed. */
  llr: number | null;
  /** LLR threshold used for signaling, when supplied. */
  llr_threshold: number | null;
  /** Reports with the drug AND the event (2×2 cell). */
  drug_ae: number | null;
  /** Reports with the drug and WITHOUT the event (2×2 cell). */
  drug_no_ae: number | null;
  /** Reports WITHOUT the drug and WITH the event (2×2 cell). */
  no_drug_ae: number | null;
  /** Reports without the drug and without the event (2×2 cell). */
  no_drug_no_ae: number | null;
}

/**
 * FAERS report-population strata exposed by this API version. The full
 * DrugCentral database carries more strata (geriatric, pediatric, …) that the
 * API does not expose — a documented upstream gap, not a client limitation.
 */
export type FaersPopulation = "all" | "male" | "female";

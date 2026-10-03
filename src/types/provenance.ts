/**
 * Provenance envelope attached to every guided-layer result.
 *
 * `retrievedAt` is the client-side clock at retrieval time — it is metadata
 * about *this request*, never a claim about when DrugCentral reviewed or
 * published anything. The API exposes **no version endpoint**; `sourceVersion`
 * is therefore always `null` ("not supplied") rather than invented.
 */
export interface Provenance {
  source: "drugcentral";
  /** Primary upstream path used to assemble the result. */
  endpoint: string;
  /** DrugCentral structure id the result is about, when applicable. */
  structId?: number;
  /** ISO-8601 timestamp of this retrieval (client clock). */
  retrievedAt: string;
  /** Always `null`: the API supplies no version metadata. */
  sourceVersion: null;
}

/** Guided-layer result: domain data plus its provenance envelope. */
export interface GuidedResult<T> {
  data: T;
  provenance: Provenance;
  /**
   * `true` when local client-side truncation was applied (e.g. a requested
   * `limit` on a search). Truncation is labeled, never presented as complete
   * upstream coverage.
   */
  truncated?: boolean;
}

import type { DrugCentralRequester } from "./http";

/**
 * Guided domain layer: higher-level, provenance-enveloped operations that
 * implement the client's core capabilities. Populated by the guided-layer
 * modules (identity resolution, structure profiles, condition
 * relationships, FAERS signals, target activity).
 */
export type DrugCentralGuide = ReturnType<typeof createDrugCentralGuide>;

/**
 * Builds the guided layer over the shared requester. Methods are attached in
 * the guided-layer tasks; every result carries a provenance envelope.
 */
export function createDrugCentralGuide(_requester: DrugCentralRequester) {
  void _requester;
  return {};
}

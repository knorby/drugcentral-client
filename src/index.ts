// @knorby/drugcentral-client — fully-typed TypeScript client for the
// DrugCentral API. Universal: Node, React Native, browsers, Bun, Deno.
// Zero runtime dependencies.
//
// Not affiliated with DrugCentral or the University of New Mexico.
// DrugCentral data is CC BY-SA 4.0 and carries no clinical guarantees —
// see README.md ("Data, license, and disclaimers"). Nothing here is
// medical advice.

export { createDrugCentralClient, type DrugCentralClient } from "./client";
export {
  DEFAULT_BASE_URL,
  DEFAULT_PAGE_SIZE,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  INITIAL_BACKOFF_MS,
  MAX_RETRIES_DEFAULT,
} from "./constants";
export {
  DrugCentralApiError,
  DrugCentralError,
  DrugCentralInvalidResponseError,
  DrugCentralNetworkError,
  DrugCentralNotFoundError,
  DrugCentralTimeoutError,
} from "./errors";
export {
  type DrugCentralGuide,
  type IdentifierMatch,
  KNOWN_IDENTIFIER_TYPES,
  type PopulationStampedSignal,
  type StructureCandidate,
  type StructureProfile,
} from "./guide";
export {
  type DrugCentralClientConfig,
  DrugCentralRequester,
  type FetchLike,
  type QueryParamValue,
} from "./http";
export { type PaginateOptions, paginateAll } from "./pagination";
export type * from "./types";
export { KNOWN_RELATIONSHIP_NAMES } from "./types/omop";
export { buildQueryString } from "./utils/serialize";

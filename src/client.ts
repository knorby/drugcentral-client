import { createDrugCentralGuide, type DrugCentralGuide } from "./guide";
import { type DrugCentralClientConfig, DrugCentralRequester } from "./http";
import {
  createAtcResource,
  createDrugClassesResource,
  createProductsResource,
  createStruct2AtcResource,
  createStruct2ObprodResource,
} from "./resources/classification";
import {
  createIdentifiersResource,
  createIdTypesResource,
  createStructuresResource,
  createSynonymsResource,
} from "./resources/identity";
import {
  createFaersResource,
  createOmopRelationshipsResource,
} from "./resources/knowledge";
import {
  createTargetActivityResource,
  createTargetsResource,
} from "./resources/targets";

/**
 * The assembled DrugCentral client: one requester shared by every resource
 * namespace, a raw path escape hatch, and the guided domain layer
 * (`client.guide`).
 */
export interface DrugCentralClient {
  /** Configured API base URL. */
  readonly baseUrl: string;
  /** The configuration this client was built from. */
  readonly config: DrugCentralClientConfig;
  /** Raw path access: parsed JSON for any endpoint, typed `unknown`. */
  readonly raw: {
    get<T = unknown>(
      path: string,
      params?: Record<string, string | number | undefined>,
      signal?: AbortSignal,
    ): Promise<T>;
    getText(
      path: string,
      params?: Record<string, string | number | undefined>,
      signal?: AbortSignal,
    ): Promise<string>;
  };
  /** Ingredient/chemical identities. */
  readonly structures: ReturnType<typeof createStructuresResource>;
  /** Name variants (one name may map to many structures). */
  readonly synonyms: ReturnType<typeof createSynonymsResource>;
  /** External-vocabulary crosswalk rows. */
  readonly identifiers: ReturnType<typeof createIdentifiersResource>;
  /** The identifier vocabularies themselves. */
  readonly idTypes: ReturnType<typeof createIdTypesResource>;
  /** Drug–condition relationships (indications, off-label, …). */
  readonly omopRelationships: ReturnType<
    typeof createOmopRelationshipsResource
  >;
  /** FAERS adverse-event signals (population-stratified). */
  readonly faers: ReturnType<typeof createFaersResource>;
  /** Marketed products (NDC/route/form). */
  readonly products: ReturnType<typeof createProductsResource>;
  /** ATC classification hierarchy. */
  readonly atc: ReturnType<typeof createAtcResource>;
  /** Pharmacologic classes. */
  readonly drugClasses: ReturnType<typeof createDrugClassesResource>;
  /** Structure ↔ ATC assignments. */
  readonly struct2atc: ReturnType<typeof createStruct2AtcResource>;
  /** Structure ↔ Orange Book product links (with strength when supplied). */
  readonly struct2obprod: ReturnType<typeof createStruct2ObprodResource>;
  /** Drug–target activity (not DDI). */
  readonly targetActivity: ReturnType<typeof createTargetActivityResource>;
  /** Target metadata cluster (dictionary, components, GO, keywords, classes,
   * junctions). */
  readonly targets: ReturnType<typeof createTargetsResource>;
  /** Guided domain layer: search, resolve, profile, knowledge. */
  readonly guide: DrugCentralGuide;
}

/**
 * Creates a DrugCentral client. Zero runtime dependencies; `fetch` defaults
 * to the runtime global (Node 18+, React Native, browsers, Bun, Deno) and
 * can be injected for polyfills, mocks, or interceptors.
 */
export function createDrugCentralClient(
  config: DrugCentralClientConfig = {},
): DrugCentralClient {
  const requester = new DrugCentralRequester(config);
  return {
    baseUrl: requester.baseUrl,
    config,
    raw: {
      get: (path, params, signal) => requester.get(path, params, signal),
      getText: (path, params, signal) =>
        requester.getText(path, params, signal),
    },
    structures: createStructuresResource(requester),
    synonyms: createSynonymsResource(requester),
    identifiers: createIdentifiersResource(requester),
    idTypes: createIdTypesResource(requester),
    omopRelationships: createOmopRelationshipsResource(requester),
    faers: createFaersResource(requester),
    products: createProductsResource(requester),
    atc: createAtcResource(requester),
    drugClasses: createDrugClassesResource(requester),
    struct2atc: createStruct2AtcResource(requester),
    struct2obprod: createStruct2ObprodResource(requester),
    targetActivity: createTargetActivityResource(requester),
    targets: createTargetsResource(requester),
    guide: createDrugCentralGuide(requester),
  };
}

// Type barrel for the DrugCentral record types, hand-written from sampled
// live payloads (the upstream OpenAPI declares no response schemas).
export type {
  AtcCode,
  DrugClass,
  Struct2Atc,
  Struct2Obprod,
} from "./classification";
export type { FaersPopulation, FaersSignal } from "./faers";
export type { IdentifierRecord, IdType } from "./identifiers";
export type { OmopRelationship } from "./omop";
export { KNOWN_RELATIONSHIP_NAMES } from "./omop";
export type { Product } from "./products";
export type { GuidedResult, Provenance } from "./provenance";
export type { DrugStructure } from "./structures";
export type { Synonym } from "./synonyms";
export type {
  ActTableFullEntry,
  TargetClass,
  TargetComponent,
  TargetDictionary,
  TargetGo,
  TargetKeyword,
  Td2Tc,
  Tdgo2Tc,
  Tdkey2Tc,
} from "./targets";

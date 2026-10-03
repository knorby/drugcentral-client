import type { DrugCentralRequester, QueryParamValue } from "../http";
import { paginateAll, type PaginateOptions } from "../pagination";
import type { DrugStructure } from "../types/structures";
import type { Synonym } from "../types/synonyms";
import type { IdType, IdentifierRecord } from "../types/identifiers";

/** Skip/limit parameters accepted by every list endpoint. */
export interface ListParams {
  skip?: number;
  limit?: number;
}

/** The delimited-export formats DrugCentral offers per resource. */
export type ExportFormat = "csv" | "tsv";

/** Percent-encodes one path segment. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

/**
 * Resource namespaces for DrugCentral identity lookups: `structures`
 * (ingredient/chemical identity), `synonyms` (name variants),
 * `identifier` (external-vocabulary crosswalk) and `id_type` (the
 * vocabularies themselves).
 *
 * All path-filter methods hit the corresponding upstream `/{resource}/
 * {field}/{value}` endpoint verbatim. A filter that matches nothing rejects
 * with `DrugCentralNotFoundError` — upstream reports no-match as HTTP 404.
 */
export function createStructuresResource(requester: DrugCentralRequester) {
  const path = "structures";
  return {
    /** Structure by DrugCentral structure id. */
    byId(id: number): Promise<DrugStructure[]> {
      return requester.get(`${path}/id/${seg(id)}`);
    },
    /** Structures whose name matches (case-insensitive contains). */
    byName(name: string): Promise<DrugStructure[]> {
      return requester.get(`${path}/name/${seg(name)}`);
    },
    /** Structures by InChIKey. */
    byInchikey(inchikey: string): Promise<DrugStructure[]> {
      return requester.get(`${path}/inchikey/${seg(inchikey)}`);
    },
    /** Structures by SMILES string (exact match). */
    bySmiles(smiles: string): Promise<DrugStructure[]> {
      return requester.get(`${path}/smiles/${seg(smiles)}`);
    },
    /** Structures by PubChem compound id. */
    byCdId(cdId: number): Promise<DrugStructure[]> {
      return requester.get(`${path}/cd_id/${seg(cdId)}`);
    },
    /** Raw list page. */
    list(params?: ListParams): Promise<DrugStructure[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    /** Auto-paginating iteration over every structure. */
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<DrugStructure> {
      return paginateAll(
        (skip, limit) => requester.get(path, { ...params, skip, limit }),
        opts,
      );
    },
    /** Raw delimited export (`structures/csv` / `structures/tsv`). */
    exportText(format: ExportFormat): Promise<string> {
      return requester.getText(`${path}/${format}`);
    },
  };
}

export function createSynonymsResource(requester: DrugCentralRequester) {
  const path = "synonyms";
  return {
    /** Synonyms belonging to one structure id. */
    byId(structId: number): Promise<Synonym[]> {
      return requester.get(`${path}/id/${seg(structId)}`);
    },
    /** One synonym row by its own id. */
    bySynId(synId: number): Promise<Synonym[]> {
      return requester.get(`${path}/syn_id/${seg(synId)}`);
    },
    /** Synonym rows whose name matches (case-insensitive contains). */
    byName(name: string): Promise<Synonym[]> {
      return requester.get(`${path}/name/${seg(name)}`);
    },
    list(params?: ListParams): Promise<Synonym[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<Synonym> {
      return paginateAll(
        (skip, limit) => requester.get(path, { ...params, skip, limit }),
        opts,
      );
    },
    exportText(format: ExportFormat): Promise<string> {
      return requester.getText(`${path}/${format}`);
    },
  };
}

export function createIdentifiersResource(requester: DrugCentralRequester) {
  const path = "identifier";
  return {
    /** One identifier row by its own id. */
    byId(id: number): Promise<IdentifierRecord[]> {
      return requester.get(`${path}/id/${seg(id)}`);
    },
    /** All external identifiers recorded for one structure. */
    byStructId(structId: number): Promise<IdentifierRecord[]> {
      return requester.get(`${path}/struct_id/${seg(structId)}`);
    },
    /** Rows for one identifier value across vocabularies. */
    byIdentifier(identifier: string): Promise<IdentifierRecord[]> {
      return requester.get(`${path}/identifier/${seg(identifier)}`);
    },
    /**
     * Rows of one vocabulary (`RXNORM`, `UNII`, …). Beware: this endpoint
     * ignores `limit` and streams the whole vocabulary table.
     */
    byIdType(idType: string): Promise<IdentifierRecord[]> {
      return requester.get(`${path}/id_type/${seg(idType)}`);
    },
    list(params?: ListParams): Promise<IdentifierRecord[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<IdentifierRecord> {
      return paginateAll(
        (skip, limit) => requester.get(path, { ...params, skip, limit }),
        opts,
      );
    },
  };
}

export function createIdTypesResource(requester: DrugCentralRequester) {
  const path = "id_type";
  return {
    /** One vocabulary row by its own id. */
    byId(id: number): Promise<IdType[]> {
      return requester.get(`${path}/id/${seg(id)}`);
    },
    /** The vocabulary row for a type code (e.g. `RXNORM`). */
    byType(type: string): Promise<IdType[]> {
      return requester.get(`${path}/type/${seg(type)}`);
    },
    /** Every supported identifier vocabulary. */
    list(): Promise<IdType[]> {
      return requester.get(path);
    },
    getAll(opts?: PaginateOptions): AsyncGenerator<IdType> {
      return paginateAll(
        (_skip, _limit) => requester.get(path),
        opts,
      );
    },
  };
}

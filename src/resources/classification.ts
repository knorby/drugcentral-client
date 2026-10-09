import type { DrugCentralRequester, QueryParamValue } from "../http";
import { type PaginateOptions, paginateAll } from "../pagination";
import type {
  AtcCode,
  DrugClass,
  Struct2Atc,
  Struct2Obprod,
} from "../types/classification";
import type { Product } from "../types/products";
import type { ExportFormat, ListParams } from "./identity";
import { seg } from "./identity";

/**
 * Resource namespaces for marketed products and classification tables:
 * `product` (formulations with NDC/route/form), `atc` (ATC hierarchy),
 * `drug_class` (pharmacologic classes), `struct2atc` and `struct2obprod`
 * (structure ↔ classification / product junctions).
 *
 * Products are **not** ingredients: ingredient-level facts (indications,
 * targets, FAERS signals) do not automatically describe every product.
 */
export function createProductsResource(requester: DrugCentralRequester) {
  const path = "product";
  return {
    /** Product by DrugCentral product id. */
    byId(id: number): Promise<Product[]> {
      return requester.get(`${path}/id/${seg(id)}`);
    },
    /** Products by NDC product code (labeler-product or full). */
    byNdcProductCode(code: string): Promise<Product[]> {
      return requester.get(`${path}/ndc_product_code/${seg(code)}`);
    },
    /** Products by marketed name (case-insensitive contains). */
    byProductName(name: string): Promise<Product[]> {
      return requester.get(`${path}/product_name/${seg(name)}`);
    },
    /** Products by route of administration (e.g. `ORAL`). */
    byRoute(route: string): Promise<Product[]> {
      return requester.get(`${path}/route/${seg(route)}`);
    },
    list(params?: ListParams): Promise<Product[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<Product> {
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

export function createAtcResource(requester: DrugCentralRequester) {
  const path = "atc";
  return {
    /** ATC rows by row id. */
    byId(id: number): Promise<AtcCode[]> {
      return requester.get(`${path}/id/${seg(id)}`);
    },
    /** ATC rows for one full code (e.g. `A01AA01`). */
    byCode(code: string): Promise<AtcCode[]> {
      return requester.get(`${path}/code/${seg(code)}`);
    },
    /** ATC rows classifying one chemical substance name. */
    byChemicalSubstance(name: string): Promise<AtcCode[]> {
      return requester.get(`${path}/chemical_substance/${seg(name)}`);
    },
    list(params?: ListParams): Promise<AtcCode[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<AtcCode> {
      return paginateAll(
        (skip, limit) => requester.get(path, { ...params, skip, limit }),
        opts,
      );
    },
  };
}

export function createDrugClassesResource(requester: DrugCentralRequester) {
  const path = "drug_class";
  return {
    /** Class rows by row id. */
    byId(id: number): Promise<DrugClass[]> {
      return requester.get(`${path}/id/${seg(id)}`);
    },
    /** Class rows by name (case-insensitive contains). */
    byName(name: string): Promise<DrugClass[]> {
      return requester.get(`${path}/name/${seg(name)}`);
    },
    /** Class rows from one vocabulary source (e.g. `LEXICOMP`). */
    bySource(source: string): Promise<DrugClass[]> {
      return requester.get(`${path}/source/${seg(source)}`);
    },
    list(params?: ListParams): Promise<DrugClass[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<DrugClass> {
      return paginateAll(
        (skip, limit) => requester.get(path, { ...params, skip, limit }),
        opts,
      );
    },
  };
}

export function createStruct2AtcResource(requester: DrugCentralRequester) {
  const path = "struct2atc";
  return {
    /** ATC assignments for one structure. */
    byStructId(structId: number): Promise<Struct2Atc[]> {
      return requester.get(`${path}/struct_id/${seg(structId)}`);
    },
    /** Structures assigned to one ATC code. */
    byAtcCode(atcCode: string): Promise<Struct2Atc[]> {
      return requester.get(`${path}/atc_code/${seg(atcCode)}`);
    },
    list(params?: ListParams): Promise<Struct2Atc[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<Struct2Atc> {
      return paginateAll(
        (skip, limit) => requester.get(path, { ...params, skip, limit }),
        opts,
      );
    },
  };
}

export function createStruct2ObprodResource(requester: DrugCentralRequester) {
  const path = "struct2obprod";
  return {
    /** Product links (with strength, when supplied) for one structure. */
    byStructId(structId: number): Promise<Struct2Obprod[]> {
      return requester.get(`${path}/struct_id/${seg(structId)}`);
    },
    /** Ingredient links for one product id. */
    byProdId(prodId: number): Promise<Struct2Obprod[]> {
      return requester.get(`${path}/prod_id/${seg(prodId)}`);
    },
    list(params?: ListParams): Promise<Struct2Obprod[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<Struct2Obprod> {
      return paginateAll(
        (skip, limit) => requester.get(path, { ...params, skip, limit }),
        opts,
      );
    },
  };
}

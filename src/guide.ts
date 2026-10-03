import { DrugCentralError } from "./errors";
import type { DrugCentralRequester } from "./http";
import {
  createIdTypesResource,
  createIdentifiersResource,
  createStructuresResource,
  createSynonymsResource,
} from "./resources/identity";
import {
  createProductsResource,
  createStruct2AtcResource,
  createStruct2ObprodResource,
} from "./resources/classification";
import { DrugCentralNotFoundError } from "./errors";
import type { GuidedResult, Provenance } from "./types/provenance";
import type { DrugStructure } from "./types/structures";
import type { Synonym } from "./types/synonyms";
import type { IdentifierRecord } from "./types/identifiers";
import type { Product } from "./types/products";
import type {
  DrugClass,
  Struct2Atc,
  Struct2Obprod,
} from "./types/classification";

/**
 * Identifier vocabularies verified live on 2026-10-03 (`/id_type` plus the
 * UNII table). This is a verified snapshot, not a guaranteed-exhaustive
 * registry — `client.idTypes.list()` returns the live set. NDC resolves
 * through the product table, not `resolveIdentifier`.
 */
export const KNOWN_IDENTIFIER_TYPES = [
  "VANDF",
  "NDFRT",
  "NDDF",
  "RXNORM",
  "MMSL",
  "SNOMEDCT_US",
  "DRUGBANK_ID",
  "MESH_DESCRIPTOR_UI",
  "MESH_SUPPLEMENTAL_RECORD_UI",
  "SECONDARY_CAS_RN",
  "UNII",
] as const;

/** A structure candidate from a guided name search. */
export interface StructureCandidate {
  /** DrugCentral structure id. */
  structId: number;
  /** The name that matched (preferred name or synonym text). */
  name: string | null;
  /** How the name matched: the structure's own/preferred name vs a synonym. */
  matchReason: "preferred-name" | "synonym";
  /** The synonym text when the match came through the synonyms table. */
  synonymName?: string;
}

/** A resolved structure match from an external identifier. */
export interface IdentifierMatch {
  /** DrugCentral structure id. */
  structId: number;
  /** The identifier value as queried. */
  identifier: string;
  /** The vocabulary the value belongs to (`RXNORM`, `UNII`, `NDC`, …). */
  idType: string;
  /** Parent link from the source row, when supplied. */
  parentMatch: number | boolean | null;
  /** Whether this came from the identifier crosswalk or an NDC product link. */
  matchKind: "identifier" | "ndc-product";
}

/** One assembled view of a structure across DrugCentral's tables. */
export interface StructureProfile {
  /** The structure record, or `null` when the id matches nothing. */
  structure: DrugStructure | null;
  /** External-vocabulary identifiers recorded for the structure. */
  identifiers: IdentifierRecord[];
  /** Name variants (including the preferred name when present). */
  synonyms: Synonym[];
  /**
   * Marketed products containing this ingredient (via struct2obprod).
   * Ingredient facts do not automatically describe every product.
   */
  products: Product[];
  /** ATC code assignments (via struct2atc). */
  atc: Struct2Atc[];
  /**
   * Pharmacologic classes. Always `[]` today: this API version exposes no
   * path from a structure to `drug_class` rows (the table filters by
   * id/name/source only). Reserved so consumers can rely on the shape.
   */
  drugClasses: DrugClass[];
}

/** Builds the provenance envelope shared by every guided result. */
function provenance(
  endpoint: string,
  structId?: number,
): Provenance {
  return {
    source: "drugcentral",
    endpoint,
    ...(structId === undefined ? {} : { structId }),
    retrievedAt: new Date().toISOString(),
    sourceVersion: null, // The API exposes no version metadata.
  };
}

/** Catches DrugCentral's no-match 404 and turns it into an empty array. */
async function tolerateNotFound<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof DrugCentralNotFoundError) return [];
    throw error;
  }
}

/**
 * Guided domain layer: higher-level, provenance-enveloped operations that
 * implement the client's core capabilities (identity search/resolution,
 * structure profiles, condition relationships, FAERS signals, target
 * activity). Guided results never relabel source vocabulary and never
 * invent absent facts.
 */
export function createDrugCentralGuide(requester: DrugCentralRequester) {
  const structures = createStructuresResource(requester);
  const synonyms = createSynonymsResource(requester);
  const identifiers = createIdentifiersResource(requester);
  const idTypes = createIdTypesResource(requester);
  const products = createProductsResource(requester);
  const struct2obprod = createStruct2ObprodResource(requester);
  const struct2atc = createStruct2AtcResource(requester);
  void idTypes; // exposed for future guided helpers; namespaces stay public

  return {
    /**
     * Searches structures by name across both the structures table (its own
     * names) and the synonyms table. Ambiguity is preserved: one query may
     * return many structures, and one structure many names; nothing is
     * auto-collapsed or auto-chosen. Duplicates by structure id keep the
     * preferred-name match reason.
     */
    async searchStructuresByName(
      name: string,
      opts?: { limit?: number },
    ): Promise<GuidedResult<StructureCandidate[]>> {
      const params = opts ? { limit: opts.limit } : undefined;
      const [structRows, synonymRows] = await Promise.all([
        tolerateNotFound(structures.byName(name)),
        tolerateNotFound(synonyms.byName(name)),
      ]);

      const candidates = new Map<number, StructureCandidate>();
      const consider = (candidate: StructureCandidate) => {
        const existing = candidates.get(candidate.structId);
        if (
          !existing ||
          (existing.matchReason === "synonym" &&
            candidate.matchReason === "preferred-name")
        ) {
          candidates.set(candidate.structId, candidate);
        }
      };
      for (const row of structRows as DrugStructure[]) {
        consider({
          structId: row.id,
          name: row.name,
          matchReason: "preferred-name",
        });
      }
      for (const row of synonymRows as Synonym[]) {
        consider({
          structId: row.id,
          name: row.name,
          matchReason: row.preferred_name === 1 ? "preferred-name" : "synonym",
          synonymName: row.name,
        });
      }
      return {
        data: [...candidates.values()],
        provenance: provenance(
          `structures/name/{name}; synonyms/name/{name}`,
        ),
      };
    },

    /**
     * Resolves an external identifier to DrugCentral structure ids. The
     * identifier vocabulary must be one this client knows (see
     * {@link KNOWN_IDENTIFIER_TYPES}); unsupported vocabularies throw instead
     * of fuzzy-matching. Name suggestions are never treated as crosswalk
     * matches. An identifier that matches nothing resolves to `[]` — no
     * match never means safe.
     */
    async resolveIdentifier(params: {
      type: string;
      value: string | number;
    }): Promise<GuidedResult<IdentifierMatch[]>> {
      const { type, value } = params;
      if (!(KNOWN_IDENTIFIER_TYPES as readonly string[]).includes(type)) {
        throw new DrugCentralError(
          `Unsupported identifier type ${JSON.stringify(type)}. ` +
            `Supported types: ${KNOWN_IDENTIFIER_TYPES.join(", ")}. ` +
            "Call client.idTypes.list() for the live registry.",
        );
      }
      const identifier = String(value);
      const rows = await tolerateNotFound(
        identifiers.byIdentifier(identifier),
      );
      const matches = (rows as IdentifierRecord[])
        .filter((row) => row.id_type === type)
        .map((row) => ({
          structId: row.struct_id,
          identifier: row.identifier,
          idType: row.id_type,
          parentMatch: row.parent_match,
          matchKind: "identifier" as const,
        }));
      return {
        data: matches,
        provenance: provenance(`identifier/identifier/${identifier}`),
      };
    },

    /** Resolves an RxNorm RxCUI to structure matches. */
    resolveByRxcui(
      rxcui: string | number,
    ): Promise<GuidedResult<IdentifierMatch[]>> {
      return this.resolveIdentifier({ type: "RXNORM", value: rxcui });
    },

    /** Resolves a UNII to structure matches. */
    resolveByUnii(
      unii: string,
    ): Promise<GuidedResult<IdentifierMatch[]>> {
      return this.resolveIdentifier({ type: "UNII", value: unii });
    },

    /**
     * Resolves an NDC product code through the product table: product →
     * ingredient structures (with strength recorded on the product link, not
     * invented here). A code with no product, or a product with no ingredient
     * links, resolves to `[]`. Ingredient-level facts still do not describe
     * every marketed product.
     */
    async resolveByNdc(
      ndcProductCode: string,
    ): Promise<GuidedResult<IdentifierMatch[]>> {
      const productRows = await tolerateNotFound(
        products.byNdcProductCode(ndcProductCode),
      );
      const links: Struct2Obprod[] = [];
      for (const product of productRows as Product[]) {
        const rows = await tolerateNotFound(
          struct2obprod.byProdId(product.id),
        );
        links.push(...(rows as Struct2Obprod[]));
      }
      return {
        data: links.map((link) => ({
          structId: link.struct_id,
          identifier: ndcProductCode,
          idType: "NDC",
          parentMatch: null,
          matchKind: "ndc-product" as const,
        })),
        provenance: provenance(
          `product/ndc_product_code/{code}; struct2obprod/prod_id/{id}`,
        ),
      };
    },

    /**
     * Assembles a structure's identity view across tables: the structure
     * record, external identifiers, synonyms, marketed products (through the
     * obprod junction), and ATC assignments — in parallel. A missing
     * structure is a normal outcome: `structure: null` with empty sections,
     * not an error. Absent fields stay absent ("not supplied"), never
     * zeroed or invented.
     */
    async getStructureProfile(
      structId: number,
    ): Promise<GuidedResult<StructureProfile>> {
      const [structureRows, identifierRows, synonymRows, links, atcRows] =
        await Promise.all([
          tolerateNotFound(structures.byId(structId)),
          tolerateNotFound(identifiers.byStructId(structId)),
          tolerateNotFound(synonyms.byId(structId)),
          tolerateNotFound(struct2obprod.byStructId(structId)),
          tolerateNotFound(struct2atc.byStructId(structId)),
        ]);
      const productRows = await Promise.all(
        (links as Struct2Obprod[]).map((link) =>
          tolerateNotFound(products.byId(link.prod_id)),
        ),
      );
      return {
        data: {
          structure: (structureRows as DrugStructure[])[0] ?? null,
          identifiers: identifierRows as IdentifierRecord[],
          synonyms: synonymRows as Synonym[],
          products: (productRows as Product[][]).flat(),
          atc: atcRows as Struct2Atc[],
          drugClasses: [],
        },
        provenance: provenance(
          "structures/id/{id}; identifier|synonyms|struct2obprod|struct2atc by struct",
          structId,
        ),
      };
    },
  };
}

export type DrugCentralGuide = ReturnType<typeof createDrugCentralGuide>;

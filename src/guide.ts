import { DrugCentralError, DrugCentralNotFoundError } from "./errors";
import type { DrugCentralRequester } from "./http";
import {
  createStruct2AtcResource,
  createStruct2ObprodResource,
} from "./resources/classification";
import {
  createIdentifiersResource,
  createIdTypesResource,
  createStructuresResource,
  createSynonymsResource,
} from "./resources/identity";
import type { FaersOptions } from "./resources/knowledge";
import {
  createFaersResource,
  createOmopRelationshipsResource,
} from "./resources/knowledge";
import { createTargetActivityResource } from "./resources/targets";
import type { Struct2Atc, Struct2Obprod } from "./types/classification";
import type { FaersPopulation, FaersSignal } from "./types/faers";
import type { IdentifierRecord } from "./types/identifiers";
import type { OmopRelationship } from "./types/omop";
import type { GuidedResult, Provenance } from "./types/provenance";
import type { DrugStructure } from "./types/structures";
import type { Synonym } from "./types/synonyms";
import type { ActTableFullEntry } from "./types/targets";

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
   * Orange Book product links for this ingredient (via struct2obprod),
   * including strength where supplied. These `prod_id`s live in the obprod
   * id space — they do not join to the `product` table's ids (verified live
   * 2026-10-03), so full Product records cannot be attached here.
   */
  obprodLinks: Struct2Obprod[];
  /** ATC code assignments (via struct2atc). */
  atc: Struct2Atc[];
}

/** A FAERS signal stamped with the report-population stratum it came from. */
export type PopulationStampedSignal = FaersSignal & {
  population: FaersPopulation;
};

/** Builds the provenance envelope shared by every guided result. */
function provenance(endpoint: string, structId?: number): Provenance {
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
  const struct2obprod = createStruct2ObprodResource(requester);
  const struct2atc = createStruct2AtcResource(requester);
  const omopRelationships = createOmopRelationshipsResource(requester);
  const faers = createFaersResource(requester);
  const targetActivity = createTargetActivityResource(requester);
  void idTypes; // exposed for future guided helpers; namespaces stay public

  return {
    /**
     * Searches structures by name across both the structures table (its own
     * names) and the synonyms table. Ambiguity is preserved: one query may
     * return many structures, and one structure many names; nothing is
     * auto-collapsed or auto-chosen. Duplicates by structure id keep the
     * preferred-name match reason.
     *
     * `opts.limit` caps the result **client-side** (the upstream name-filter
     * endpoints ignore `limit`); when capping drops candidates, the result
     * carries `truncated: true` — truncation is labeled, never implied
     * complete.
     */
    async searchStructuresByName(
      name: string,
      opts?: { limit?: number },
    ): Promise<GuidedResult<StructureCandidate[]>> {
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
        data:
          opts?.limit === undefined || candidates.size <= opts.limit
            ? [...candidates.values()]
            : [...candidates.values()].slice(0, opts.limit),
        truncated:
          opts?.limit === undefined || candidates.size <= opts.limit
            ? undefined
            : true,
        provenance: provenance(`structures/name/{name}; synonyms/name/{name}`),
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
      const rows = await tolerateNotFound(identifiers.byIdentifier(identifier));
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
    resolveByUnii(unii: string): Promise<GuidedResult<IdentifierMatch[]>> {
      return this.resolveIdentifier({ type: "UNII", value: unii });
    },

    /**
     * **Not supported by this API version — always throws.** Resolving an
     * NDC to ingredient structures requires joining the `product` table to
     * `struct2obprod`, but their product ids are disjoint id spaces
     * (verified live 2026-10-03: product id 2928251 has no obprod rows;
     * obprod prod_id 639159 has no product row) and no obprod-by-NDC
     * endpoint is exposed. Kept as an explicit, documented unsupported
     * capability rather than silently returning empty matches. Use
     * `resolveByRxcui`/`resolveByUnii` or `searchStructuresByName` instead.
     */
    async resolveByNdc(
      _ndcProductCode: string,
    ): Promise<GuidedResult<IdentifierMatch[]>> {
      throw new DrugCentralError(
        "NDC → structure resolution is not supported by this DrugCentral API version: " +
          "the product table and struct2obprod reference disjoint product id spaces, " +
          "and no obprod-by-NDC endpoint exists (verified 2026-10-03). " +
          "Use resolveByRxcui, resolveByUnii, or searchStructuresByName.",
      );
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
      return {
        data: {
          structure: (structureRows as DrugStructure[])[0] ?? null,
          identifiers: identifierRows as IdentifierRecord[],
          synonyms: synonymRows as Synonym[],
          obprodLinks: links as Struct2Obprod[],
          atc: atcRows as Struct2Atc[],
        },
        provenance: provenance(
          "structures/id/{id}; identifier|synonyms|struct2obprod|struct2atc by struct",
          structId,
        ),
      };
    },

    /**
     * Drug–condition relationships for one structure, preserving the verbatim
     * `relationship_name` on every record. `kinds` filters by **exact string
     * equality** client-side — never the upstream substring-matching
     * relationship filter (see the omop resource warning). `limit` caps the
     * result client-side with `truncated: true` when capping drops rows —
     * upstream ignores `limit` on filtered endpoints, so capping cannot be
     * delegated. Inclusion in DrugCentral is not regulator approval; these
     * rows carry no patient predicates, severity, or management guidance.
     */
    async getConditionRelationships(
      structId: number,
      opts?: { kinds?: string[]; limit?: number },
    ): Promise<GuidedResult<OmopRelationship[]>> {
      const rows = await tolerateNotFound(
        omopRelationships.byStructId(structId),
      );
      const filtered =
        opts?.kinds === undefined
          ? (rows as OmopRelationship[])
          : (rows as OmopRelationship[]).filter((row) =>
              opts.kinds?.includes(row.relationship_name),
            );
      const capped = opts?.limit !== undefined && filtered.length > opts.limit;
      return {
        data: capped ? filtered.slice(0, opts.limit) : filtered,
        ...(capped ? { truncated: true } : {}),
        provenance: provenance("omop_relationship/struct_id/{id}", structId),
      };
    },

    /** Relationships labeled exactly `"indication"`. */
    getIndications(
      structId: number,
      opts?: { limit?: number },
    ): Promise<GuidedResult<OmopRelationship[]>> {
      return this.getConditionRelationships(structId, {
        kinds: ["indication"],
        ...opts,
      });
    },

    /** Relationships labeled exactly `"off-label use"`. */
    getOffLabelUses(
      structId: number,
      opts?: { limit?: number },
    ): Promise<GuidedResult<OmopRelationship[]>> {
      return this.getConditionRelationships(structId, {
        kinds: ["off-label use"],
        ...opts,
      });
    },

    /** Relationships labeled exactly `"contraindication"`. */
    getContraindications(
      structId: number,
      opts?: { limit?: number },
    ): Promise<GuidedResult<OmopRelationship[]>> {
      return this.getConditionRelationships(structId, {
        kinds: ["contraindication"],
        ...opts,
      });
    },

    /**
     * FAERS adverse-event signals for one structure, stamped with the
     * report-population stratum. These are disproportionality statistics —
     * report contingencies, **not incidence rates**, and never causality.
     * Empty results mean "no signal rows", never "no risk".
     */
    async getFaersSignals(
      structId: number,
      opts?: FaersOptions,
    ): Promise<GuidedResult<PopulationStampedSignal[]>> {
      const rows = await tolerateNotFound(
        faers.byStructId(structId, { population: opts?.population }),
      );
      const population: FaersPopulation = opts?.population ?? "all";
      return {
        data: (rows as FaersSignal[]).map((row) => ({
          ...row,
          population,
        })),
        provenance: provenance(
          `faers${population === "all" ? "" : `_${population}`}/struct_id/{id}`,
          structId,
        ),
      };
    },

    /**
     * Drug–**target** activity for one structure: what the compound does to
     * proteins, with action types and MoA provenance. Distinct from
     * drug–drug interaction — no pairwise DDI semantics exist here.
     */
    async getTargetActivity(
      structId: number,
    ): Promise<GuidedResult<ActTableFullEntry[]>> {
      const rows = await tolerateNotFound(targetActivity.byStructId(structId));
      return {
        data: rows as ActTableFullEntry[],
        provenance: provenance("act_table_full/struct_id/{id}", structId),
      };
    },
  };
}

export type DrugCentralGuide = ReturnType<typeof createDrugCentralGuide>;

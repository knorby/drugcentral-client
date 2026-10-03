import type { DrugCentralRequester, QueryParamValue } from "../http";
import { type PaginateOptions, paginateAll } from "../pagination";
import type { FaersPopulation, FaersSignal } from "../types/faers";
import type { OmopRelationship } from "../types/omop";
import type { ExportFormat, ListParams } from "./identity";
import { seg } from "./identity";

/**
 * Drug–condition relationships (`omop_relationship`): indications,
 * contraindications, off-label uses and other source-vocabulary assertions,
 * always preserving the verbatim `relationship_name` label.
 *
 * @warning The upstream `relationship_name` filter is a **substring match**:
 * filtering by `"indication"` also returns `"contraindication"` rows
 * (verified live 2026-10-03). For exact-kind retrieval, fetch by `struct_id`
 * and compare `relationship_name` with `===` client-side — which is what the
 * guided layer does.
 */
export function createOmopRelationshipsResource(
  requester: DrugCentralRequester,
) {
  const path = "omop_relationship";
  return {
    /** One relationship row by its own id. */
    byId(id: number): Promise<OmopRelationship[]> {
      return requester.get(`${path}/id/${seg(id)}`);
    },
    /** Every relationship for one structure (exact; safe for client-side
     * exact-kind filtering). */
    byStructId(structId: number): Promise<OmopRelationship[]> {
      return requester.get(`${path}/struct_id/${seg(structId)}`);
    },
    /** Relationships pointing at one OMOP concept id. */
    byConceptId(conceptId: number): Promise<OmopRelationship[]> {
      return requester.get(`${path}/concept_id/${seg(conceptId)}`);
    },
    /** Relationships pointing at a concept by name (contains match). */
    byConceptName(name: string): Promise<OmopRelationship[]> {
      return requester.get(`${path}/concept_name/${seg(name)}`);
    },
    /** Relationships pointing at a UMLS CUI. */
    byUmlsCui(cui: string): Promise<OmopRelationship[]> {
      return requester.get(`${path}/umls_cui/${seg(cui)}`);
    },
    /** Relationships pointing at a SNOMED CT concept id. */
    bySnomedConceptId(conceptId: number | string): Promise<OmopRelationship[]> {
      return requester.get(`${path}/snomed_conceptid/${seg(conceptId)}`);
    },
    /** Relationships for one UMLS semantic type (e.g. `T047`). */
    byCuiSemanticType(type: string): Promise<OmopRelationship[]> {
      return requester.get(`${path}/cui_semantic_type/${seg(type)}`);
    },
    /**
     * Relationships by label. **Substring match upstream** — see the warning
     * on this resource. Pass the label verbatim (e.g. `"off-label use"`).
     */
    byRelationshipName(name: string): Promise<OmopRelationship[]> {
      return requester.get(`${path}/relationship_name/${seg(name)}`);
    },
    list(params?: ListParams): Promise<OmopRelationship[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<OmopRelationship> {
      return paginateAll(
        (skip, limit) => requester.get(path, { ...params, skip, limit }),
        opts,
      );
    },
  };
}

/** Options selecting the FAERS report-population stratum. */
export interface FaersOptions {
  /**
   * Report-population stratum. Only `all`/`male`/`female` are exposed by this
   * API version (the DrugCentral database carries more strata — a documented
   * upstream gap).
   * @default "all"
   */
  population?: FaersPopulation;
}

const POPULATION_PATHS: Record<FaersPopulation, string> = {
  all: "faers",
  male: "faers_male",
  female: "faers_female",
};

function populationPath(path: FaersOptions["population"]): string {
  const population = path ?? "all";
  const table = POPULATION_PATHS[population];
  if (table === undefined) {
    throw new RangeError(
      `Unknown FAERS population ${JSON.stringify(population)}; supported: all, male, female`,
    );
  }
  return table;
}

/**
 * FAERS adverse-event **signals** (disproportionality statistics — report
 * contingencies, never incidence rates and never causality). The population
 * stratum selects the upstream `faers` / `faers_male` / `faers_female` table
 * and is preserved by the guided layer on every record.
 */
export function createFaersResource(requester: DrugCentralRequester) {
  return {
    /** One signal row by its own id. */
    byId(id: number, opts?: FaersOptions): Promise<FaersSignal[]> {
      return requester.get(`${populationPath(opts?.population)}/id/${seg(id)}`);
    },
    /** Signals for one structure. */
    byStructId(structId: number, opts?: FaersOptions): Promise<FaersSignal[]> {
      return requester.get(
        `${populationPath(opts?.population)}/struct_id/${seg(structId)}`,
      );
    },
    /** Signals for one MedDRA code. */
    byMeddraCode(
      code: number | string,
      opts?: FaersOptions,
    ): Promise<FaersSignal[]> {
      return requester.get(
        `${populationPath(opts?.population)}/meddra_code/${seg(code)}`,
      );
    },
    /** Signals for a MedDRA name (contains match). */
    byMeddraName(name: string, opts?: FaersOptions): Promise<FaersSignal[]> {
      return requester.get(
        `${populationPath(opts?.population)}/meddra_name/${seg(name)}`,
      );
    },
    list(params?: ListParams & FaersOptions): Promise<FaersSignal[]> {
      const { population, ...rest } = params ?? {};
      return requester.get(
        populationPath(population),
        rest as Record<string, QueryParamValue>,
      );
    },
    getAll(
      params?: Omit<ListParams & FaersOptions, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<FaersSignal> {
      const { population, ...rest } = params ?? {};
      const path = populationPath(population);
      return paginateAll(
        (skip, limit) => requester.get(path, { ...rest, skip, limit }),
        opts,
      );
    },
    /** Raw delimited export for a stratum (`csv`/`tsv`). */
    exportText(format: ExportFormat, opts?: FaersOptions): Promise<string> {
      return requester.getText(`${populationPath(opts?.population)}/${format}`);
    },
  };
}

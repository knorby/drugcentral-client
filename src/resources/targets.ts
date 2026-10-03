import type { DrugCentralRequester, QueryParamValue } from "../http";
import { paginateAll, type PaginateOptions } from "../pagination";
import type {
  ActTableFullEntry,
  TargetClass,
  TargetComponent,
  TargetDictionary,
  TargetGo,
  TargetKeyword,
  Td2Tc,
  Tdgo2Tc,
  Tdkey2Tc,
} from "../types/targets";
import type { ListParams, ExportFormat } from "./identity";
import { seg } from "./identity";

/**
 * Drug–**target** activity (`act_table_full`): what a compound does to a
 * protein — activity measurements, action types, and mechanism-of-action
 * assertions with source provenance.
 *
 * This is not drug–drug interaction data. No pairwise DDI semantics exist in
 * this table; presenting these rows as medication-interaction warnings is a
 * category error the types are deliberately named to prevent.
 */
export function createTargetActivityResource(requester: DrugCentralRequester) {
  const path = "act_table_full";
  return {
    /** Activity rows for one structure. */
    byStructId(structId: number): Promise<ActTableFullEntry[]> {
      return requester.get(`${path}/struct_id/${seg(structId)}`);
    },
    /** One activity row by its own id. */
    byActId(actId: number): Promise<ActTableFullEntry[]> {
      return requester.get(`${path}/act_id/${seg(actId)}`);
    },
    /** Rows for a UniProt accession (`|`-joined for complexes). */
    byAccession(accession: string): Promise<ActTableFullEntry[]> {
      return requester.get(`${path}/accession/${seg(accession)}`);
    },
    /** Rows of one activity type (e.g. `IC50`). */
    byActType(actType: string): Promise<ActTableFullEntry[]> {
      return requester.get(`${path}/act_type/${seg(actType)}`);
    },
    /** Rows for a gene symbol (`|`-joined for complexes). */
    byGene(gene: string): Promise<ActTableFullEntry[]> {
      return requester.get(`${path}/gene/${seg(gene)}`);
    },
    /** Rows measured in one organism. */
    byOrganism(organism: string): Promise<ActTableFullEntry[]> {
      return requester.get(`${path}/organism/${seg(organism)}`);
    },
    /** Rows for a Swiss-Prot entry name. */
    bySwissprot(swissprot: string): Promise<ActTableFullEntry[]> {
      return requester.get(`${path}/swissprot/${seg(swissprot)}`);
    },
    /** Rows for a target class label. */
    byTargetClass(targetClass: string): Promise<ActTableFullEntry[]> {
      return requester.get(`${path}/target_class/${seg(targetClass)}`);
    },
    list(params?: ListParams): Promise<ActTableFullEntry[]> {
      return requester.get(path, params as Record<string, QueryParamValue>);
    },
    getAll(
      params?: Omit<ListParams, "skip" | "limit">,
      opts?: PaginateOptions,
    ): AsyncGenerator<ActTableFullEntry> {
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

/**
 * The target metadata cluster: `target_dictionary` (targets),
 * `target_component` (protein chains), `target_go` (Gene Ontology
 * annotations), `target_keyword` (keyword tags), `target_class` (the level-1
 * taxonomy) and the three junction tables linking targets/components to GO
 * terms and keywords.
 */
export function createTargetsResource(requester: DrugCentralRequester) {
  return {
    /** Target dictionary (`target_dictionary`). */
    dictionary: {
      byId(id: number): Promise<TargetDictionary[]> {
        return requester.get(`target_dictionary/id/${seg(id)}`);
      },
      byTargetClass(targetClass: string): Promise<TargetDictionary[]> {
        return requester.get(
          `target_dictionary/target_class/${seg(targetClass)}`,
        );
      },
      list(params?: ListParams): Promise<TargetDictionary[]> {
        return requester.get(
          "target_dictionary",
          params as Record<string, QueryParamValue>,
        );
      },
      getAll(
        params?: Omit<ListParams, "skip" | "limit">,
        opts?: PaginateOptions,
      ): AsyncGenerator<TargetDictionary> {
        return paginateAll(
          (skip, limit) =>
            requester.get("target_dictionary", { ...params, skip, limit }),
          opts,
        );
      },
    },
    /** Target components / protein chains (`target_component`). */
    component: {
      byId(id: number): Promise<TargetComponent[]> {
        return requester.get(`target_component/id/${seg(id)}`);
      },
      byAccession(accession: string): Promise<TargetComponent[]> {
        return requester.get(`target_component/accession/${seg(accession)}`);
      },
      byGene(gene: string): Promise<TargetComponent[]> {
        return requester.get(`target_component/gene/${seg(gene)}`);
      },
      byOrganism(organism: string): Promise<TargetComponent[]> {
        return requester.get(`target_component/organism/${seg(organism)}`);
      },
      bySwissprot(swissprot: string): Promise<TargetComponent[]> {
        return requester.get(`target_component/swissprot/${seg(swissprot)}`);
      },
      list(params?: ListParams): Promise<TargetComponent[]> {
        return requester.get(
          "target_component",
          params as Record<string, QueryParamValue>,
        );
      },
      getAll(
        params?: Omit<ListParams, "skip" | "limit">,
        opts?: PaginateOptions,
      ): AsyncGenerator<TargetComponent> {
        return paginateAll(
          (skip, limit) =>
            requester.get("target_component", { ...params, skip, limit }),
          opts,
        );
      },
      exportText(format: ExportFormat): Promise<string> {
        return requester.getText(`target_component/${format}`);
      },
    },
    /** Gene Ontology annotations (`target_go`; ids are strings upstream). */
    go: {
      byId(id: string): Promise<TargetGo[]> {
        return requester.get(`target_go/id/${seg(id)}`);
      },
      byType(type: string): Promise<TargetGo[]> {
        return requester.get(`target_go/type/${seg(type)}`);
      },
      list(params?: ListParams): Promise<TargetGo[]> {
        return requester.get(
          "target_go",
          params as Record<string, QueryParamValue>,
        );
      },
      getAll(
        params?: Omit<ListParams, "skip" | "limit">,
        opts?: PaginateOptions,
      ): AsyncGenerator<TargetGo> {
        return paginateAll(
          (skip, limit) => requester.get("target_go", { ...params, skip, limit }),
          opts,
        );
      },
    },
    /** Target keyword tags (`target_keyword`; ids are strings upstream). */
    keyword: {
      byId(id: string): Promise<TargetKeyword[]> {
        return requester.get(`target_keyword/id/${seg(id)}`);
      },
      byKeyword(keyword: string): Promise<TargetKeyword[]> {
        return requester.get(`target_keyword/keyword/${seg(keyword)}`);
      },
      byCategory(category: string): Promise<TargetKeyword[]> {
        return requester.get(`target_keyword/category/${seg(category)}`);
      },
      list(params?: ListParams): Promise<TargetKeyword[]> {
        return requester.get(
          "target_keyword",
          params as Record<string, QueryParamValue>,
        );
      },
      getAll(
        params?: Omit<ListParams, "skip" | "limit">,
        opts?: PaginateOptions,
      ): AsyncGenerator<TargetKeyword> {
        return paginateAll(
          (skip, limit) =>
            requester.get("target_keyword", { ...params, skip, limit }),
          opts,
        );
      },
    },
    /** Target class taxonomy (`target_class`). */
    classes: {
      byId(id: number): Promise<TargetClass[]> {
        return requester.get(`target_class/id/${seg(id)}`);
      },
      byL1(l1: string): Promise<TargetClass[]> {
        return requester.get(`target_class/l1/${seg(l1)}`);
      },
      list(params?: ListParams): Promise<TargetClass[]> {
        return requester.get(
          "target_class",
          params as Record<string, QueryParamValue>,
        );
      },
      getAll(
        params?: Omit<ListParams, "skip" | "limit">,
        opts?: PaginateOptions,
      ): AsyncGenerator<TargetClass> {
        return paginateAll(
          (skip, limit) =>
            requester.get("target_class", { ...params, skip, limit }),
          opts,
        );
      },
    },
    /** Target dictionary ↔ component junction (`td2tc`). */
    td2tc: {
      byTargetId(targetId: number): Promise<Td2Tc[]> {
        return requester.get(`td2tc/target_id/${seg(targetId)}`);
      },
      byComponentId(componentId: number): Promise<Td2Tc[]> {
        return requester.get(`td2tc/component_id/${seg(componentId)}`);
      },
      list(params?: ListParams): Promise<Td2Tc[]> {
        return requester.get(
          "td2tc",
          params as Record<string, QueryParamValue>,
        );
      },
      getAll(
        params?: Omit<ListParams, "skip" | "limit">,
        opts?: PaginateOptions,
      ): AsyncGenerator<Td2Tc> {
        return paginateAll(
          (skip, limit) => requester.get("td2tc", { ...params, skip, limit }),
          opts,
        );
      },
    },
    /** GO ↔ component junction (`tdgo2tc`; `go_id` is a string upstream). */
    tdgo2tc: {
      byGoId(goId: string): Promise<Tdgo2Tc[]> {
        return requester.get(`tdgo2tc/go_id/${seg(goId)}`);
      },
      byComponentId(componentId: number): Promise<Tdgo2Tc[]> {
        return requester.get(`tdgo2tc/component_id/${seg(componentId)}`);
      },
      list(params?: ListParams): Promise<Tdgo2Tc[]> {
        return requester.get(
          "tdgo2tc",
          params as Record<string, QueryParamValue>,
        );
      },
      getAll(
        params?: Omit<ListParams, "skip" | "limit">,
        opts?: PaginateOptions,
      ): AsyncGenerator<Tdgo2Tc> {
        return paginateAll(
          (skip, limit) => requester.get("tdgo2tc", { ...params, skip, limit }),
          opts,
        );
      },
    },
    /** Keyword ↔ component junction (`tdkey2tc`; `tdkey_id` is a string
     * upstream). */
    tdkey2tc: {
      byTdKeyId(tdkeyId: string): Promise<Tdkey2Tc[]> {
        return requester.get(`tdkey2tc/tdkey_id/${seg(tdkeyId)}`);
      },
      byComponentId(componentId: number): Promise<Tdkey2Tc[]> {
        return requester.get(`tdkey2tc/component_id/${seg(componentId)}`);
      },
      list(params?: ListParams): Promise<Tdkey2Tc[]> {
        return requester.get(
          "tdkey2tc",
          params as Record<string, QueryParamValue>,
        );
      },
      getAll(
        params?: Omit<ListParams, "skip" | "limit">,
        opts?: PaginateOptions,
      ): AsyncGenerator<Tdkey2Tc> {
        return paginateAll(
          (skip, limit) => requester.get("tdkey2tc", { ...params, skip, limit }),
          opts,
        );
      },
    },
  };
}

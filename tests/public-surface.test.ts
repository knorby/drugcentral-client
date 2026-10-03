import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createDrugCentralClient,
  type IdentifierMatch,
  KNOWN_IDENTIFIER_TYPES,
  KNOWN_RELATIONSHIP_NAMES,
  type PopulationStampedSignal,
  type StructureCandidate,
  type StructureProfile,
} from "../src/index";

describe("public export surface", () => {
  test("KNOWN_RELATIONSHIP_NAMES is a value export with the verified labels", () => {
    expect(Array.isArray(KNOWN_RELATIONSHIP_NAMES)).toBe(true);
    expect(KNOWN_RELATIONSHIP_NAMES).toContain("off-label use");
    expect(KNOWN_RELATIONSHIP_NAMES).toContain("indication");
    expect(KNOWN_RELATIONSHIP_NAMES).toContain("contraindication");
  });

  test("KNOWN_IDENTIFIER_TYPES is a value export", () => {
    expect(KNOWN_IDENTIFIER_TYPES).toContain("RXNORM");
    expect(KNOWN_IDENTIFIER_TYPES).toContain("UNII");
  });

  test("guided-layer types are importable for consumer annotations", () => {
    const candidate: StructureCandidate = {
      structId: 1,
      name: "x",
      matchReason: "preferred-name",
    };
    const match: IdentifierMatch = {
      structId: 1,
      identifier: "1",
      idType: "RXNORM",
      parentMatch: null,
      matchKind: "identifier",
    };
    const profile: StructureProfile = {
      structure: null,
      identifiers: [],
      synonyms: [],
      obprodLinks: [],
      atc: [],
      drugClasses: [],
    };
    const signal: PopulationStampedSignal = {
      id: 1,
      struct_id: 1,
      meddra_code: 1,
      meddra_name: "x",
      level: "PT",
      llr: 1,
      llr_threshold: 1,
      drug_ae: 1,
      drug_no_ae: 1,
      no_drug_ae: 1,
      no_drug_no_ae: 1,
      population: "all",
    };
    expect([candidate, match, profile, signal]).toHaveLength(4);
  });
});

describe("guided name-search limit is honored and labeled", () => {
  test("limit caps client-side and marks truncated=true", async () => {
    const { routingFetch } = await import("./helpers");
    const routed = createDrugCentralClient({
      baseUrl: "https://x.test",
      fetch: routingFetch({
        "structures/name/ibu": [
          { id: 1, name: "ibuprofen" },
          { id: 2, name: "ibuprofen-picol" },
        ],
        "synonyms/name/ibu": [
          {
            id: 3,
            name: "ibuprofen lys",
            lname: "x",
            preferred_name: null,
            syn_id: 1,
            parent_id: null,
          },
          {
            id: 4,
            name: "ibuprofen gua",
            lname: "x",
            preferred_name: null,
            syn_id: 2,
            parent_id: null,
          },
        ],
      }).fetch,
    });
    const full = await routed.guide.searchStructuresByName("ibu");
    expect(full.data).toHaveLength(4);
    expect(full.truncated).toBeUndefined();

    const capped = await routed.guide.searchStructuresByName("ibu", {
      limit: 2,
    });
    expect(capped.data).toHaveLength(2);
    expect(capped.truncated).toBe(true);
  });
});

const distDir = join(import.meta.dirname, "../dist");
const distBuilt = existsSync(join(distDir, "index.d.ts"));

describe.skipIf(!distBuilt)(
  "shipped declarations resolve under nodenext",
  () => {
    test("no extensionless relative imports remain in dist/*.d.ts", () => {
      const offenders: string[] = [];
      for (const file of readdirSync(distDir)) {
        if (!file.endsWith(".d.ts") && !file.endsWith(".d.cts")) continue;
        const text = readFileSync(join(distDir, file), "utf8");
        const matches = text.matchAll(/from\s+"(\.\.?\/[^"]+)"/g);
        for (const m of matches) {
          const spec = m[1] ?? "";
          if (!spec.endsWith(".js") && !spec.endsWith(".json")) {
            offenders.push(`${file}: ${spec}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  },
);

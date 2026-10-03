import { describe, expect, test } from "vitest";
import {
  DEFAULT_BASE_URL,
  DrugCentralApiError,
  DrugCentralError,
  DrugCentralInvalidResponseError,
  DrugCentralNetworkError,
  DrugCentralNotFoundError,
  DrugCentralTimeoutError,
  buildQueryString,
  createDrugCentralClient,
  paginateAll,
} from "../src/index";
import { queuedFetch } from "./helpers";

describe("createDrugCentralClient", () => {
  test("namespaces share one requester and hit the configured base", async () => {
    const mock = queuedFetch([
      [{ id: 1 }], // structures.byId
      [{ id: 2 }], // faers.byStructId
      [{ id: 3 }], // targets.dictionary.byId
    ]);
    const client = createDrugCentralClient({
      baseUrl: "https://drugcentral.test",
      fetch: mock.fetch,
    });
    await client.structures.byId(1);
    await client.faers.byStructId(2);
    await client.targets.dictionary.byId(3);
    expect(mock.urls).toEqual([
      "https://drugcentral.test/structures/id/1",
      "https://drugcentral.test/faers/struct_id/2",
      "https://drugcentral.test/target_dictionary/id/3",
    ]);
    expect(client.baseUrl).toBe("https://drugcentral.test");
  });

  test("defaults the base URL to the production host", () => {
    const client = createDrugCentralClient({ fetch: queuedFetch([]).fetch });
    expect(client.baseUrl).toBe(DEFAULT_BASE_URL);
  });

  test("raw.get exposes any path with query params", async () => {
    const mock = queuedFetch([[[{ id: 1 }]]]);
    const client = createDrugCentralClient({
      baseUrl: "https://drugcentral.test",
      fetch: mock.fetch,
    });
    const data = await client.raw.get("omop_relationship", { limit: 1 });
    expect(mock.urls[0]).toBe(
      "https://drugcentral.test/omop_relationship?limit=1",
    );
    expect(data).toEqual([[{ id: 1 }]]);
  });

  test("raw.getText exposes delimited exports", async () => {
    const mock = queuedFetch([
      { status: 200, body: "a,b", contentType: "text/csv" },
    ]);
    const client = createDrugCentralClient({
      baseUrl: "https://drugcentral.test",
      fetch: mock.fetch,
    });
    const text = await client.raw.getText("faers/csv");
    expect(text).toBe("a,b");
  });

  test("guide is present (filled in by the guided-layer tasks)", () => {
    const client = createDrugCentralClient({ fetch: queuedFetch([]).fetch });
    expect(client.guide).toBeDefined();
  });

  test("exports the error taxonomy and helpers", () => {
    expect(new DrugCentralError("x")).toBeInstanceOf(Error);
    expect(DrugCentralApiError).toBeDefined();
    expect(DrugCentralInvalidResponseError).toBeDefined();
    expect(DrugCentralNetworkError).toBeDefined();
    expect(DrugCentralNotFoundError).toBeDefined();
    expect(DrugCentralTimeoutError).toBeDefined();
    expect(typeof buildQueryString).toBe("function");
    expect(typeof paginateAll).toBe("function");
  });
});

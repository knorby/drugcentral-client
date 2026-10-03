import { describe, expect, test } from "vitest";
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } from "../src/constants";
import {
  DrugCentralApiError,
  DrugCentralError,
  DrugCentralInvalidResponseError,
  DrugCentralNetworkError,
  DrugCentralNotFoundError,
  DrugCentralTimeoutError,
} from "../src/errors";
import { DrugCentralRequester } from "../src/http";
import { hangingFetch, queuedFetch, rejectingFetch } from "./helpers";

const BASE = "https://drugcentral.test";

function makeRequester(
  responses: Parameters<typeof queuedFetch>[0],
  config: Record<string, unknown> = {},
) {
  const mock = queuedFetch(responses);
  const requester = new DrugCentralRequester({
    baseUrl: BASE,
    fetch: mock.fetch,
    ...config,
  });
  return { requester, mock };
}

describe("URL building", () => {
  test("builds path URL against base with encoded query params", async () => {
    const { requester, mock } = makeRequester([]);
    await requester
      .get("omop_relationship", { limit: 1, skip: 0, q: "a b&c=d" })
      .catch(() => {});
    expect(mock.urls[0]).toBe(
      `${BASE}/omop_relationship?limit=1&skip=0&q=${encodeURIComponent("a b&c=d")}`,
    );
  });

  test("trims trailing slashes from the configured base URL", () => {
    const { requester } = makeRequester([]);
    expect(requester.baseUrl).toBe(BASE);
    const slashed = new DrugCentralRequester({ baseUrl: `${BASE}//` });
    expect(slashed.baseUrl).toBe(BASE);
  });

  test("defaults the base URL to the production DrugCentral host", () => {
    expect(DEFAULT_BASE_URL).toBe(
      "https://uxn2ycvimg.us-east-2.awsapprunner.com",
    );
  });

  test("omits undefined params from the query string", async () => {
    const { requester, mock } = makeRequester([]);
    await requester
      .get("structures", { limit: undefined, skip: 0 })
      .catch(() => {});
    expect(mock.urls[0]).toBe(`${BASE}/structures?skip=0`);
  });
});

describe("headers", () => {
  test("sends Accept JSON and a package User-Agent by default", async () => {
    const { requester, mock } = makeRequester([{ id: 1 }]);
    await requester.get("atc");
    const headers = mock.inits[0].headers as Record<string, string>;
    expect(headers.accept).toBe("application/json");
    expect(headers["user-agent"]).toMatch(/^@knorby\/drugcentral-client\//);
  });

  test("merges custom config headers and honors a userAgent override", async () => {
    const mock = queuedFetch([{ id: 1 }]);
    const requester = new DrugCentralRequester({
      baseUrl: BASE,
      fetch: mock.fetch,
      headers: { "X-Custom": "yes" },
      userAgent: "my-agent/1",
    });
    await requester.get("atc");
    const headers = mock.inits[0].headers as Record<string, string>;
    expect(headers["x-custom"]).toBe("yes");
    expect(headers["user-agent"]).toBe("my-agent/1");
  });
});

describe("responses", () => {
  test("parses a JSON array response", async () => {
    const { requester } = makeRequester([[{ id: 1 }, { id: 2 }]]);
    const data = await requester.get<{ id: number }[]>("faers");
    expect(data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test("getText returns the raw body text without parsing", async () => {
    const { requester } = makeRequester([
      { status: 200, body: "a,b\n1,2", contentType: "text/csv" },
    ]);
    const text = await requester.getText("faers/csv");
    expect(text).toBe("a,b\n1,2");
  });

  test("non-JSON 200 body throws DrugCentralInvalidResponseError with an excerpt", async () => {
    const { requester } = makeRequester([
      { status: 200, body: "Internal something went wrong" },
    ]);
    const error = await requester.get("structures").catch((e) => e);
    expect(error).toBeInstanceOf(DrugCentralInvalidResponseError);
    expect(error.bodyExcerpt).toContain("Internal something went wrong");
    expect(error.url).toContain("/structures");
  });

  test("non-2xx throws DrugCentralApiError with status, body, and url", async () => {
    const { requester } = makeRequester([
      { status: 500, body: "Internal Server Error" },
    ]);
    const error = await requester.get("structures").catch((e) => e);
    expect(error).toBeInstanceOf(DrugCentralApiError);
    expect(error.status).toBe(500);
    expect(error.body).toBe("Internal Server Error");
    expect(error.url).toContain("/structures");
    expect(error).toBeInstanceOf(DrugCentralError);
  });

  test("non-2xx with JSON body is still an ApiError carrying the body", async () => {
    const { requester } = makeRequester([
      { status: 422, body: '{"detail":[{"loc":["query","limit"]}]}' },
    ]);
    const error = await requester.get("structures").catch((e) => e);
    expect(error).toBeInstanceOf(DrugCentralApiError);
    expect(error.status).toBe(422);
  });

  test("404 with a not-found detail body throws DrugCentralNotFoundError", async () => {
    const { requester } = makeRequester([
      { status: 404, body: '{"detail":"struct_id not found"}' },
    ]);
    const error = await requester
      .get("structures/id/999999999")
      .catch((e) => e);
    expect(error).toBeInstanceOf(DrugCentralNotFoundError);
    expect(error).toBeInstanceOf(DrugCentralApiError);
    expect(error.status).toBe(404);
    expect(error.message).toContain("struct_id not found");
  });
});

describe("failure mapping", () => {
  test("timeout aborts and throws DrugCentralTimeoutError", async () => {
    const { fetch, urls } = hangingFetch();
    const requester = new DrugCentralRequester({
      baseUrl: BASE,
      timeoutMs: 15,
      fetch,
    });
    const error = await requester.get("structures").catch((e) => e);
    expect(error).toBeInstanceOf(DrugCentralTimeoutError);
    expect(error.timeoutMs).toBe(15);
    expect(urls).toHaveLength(1);
  });

  test("transport rejection throws DrugCentralNetworkError with cause", async () => {
    const cause = new TypeError("fetch failed");
    const { fetch } = rejectingFetch(cause);
    const requester = new DrugCentralRequester({ baseUrl: BASE, fetch });
    const error = await requester.get("structures").catch((e) => e);
    expect(error).toBeInstanceOf(DrugCentralNetworkError);
    expect(error.cause).toBe(cause);
  });

  test("consumer abort re-throws the original abort error unwrapped", async () => {
    const { fetch } = hangingFetch();
    const requester = new DrugCentralRequester({
      baseUrl: BASE,
      timeoutMs: 60_000,
      fetch,
    });
    const controller = new AbortController();
    const pending = requester.get("structures", undefined, controller.signal);
    controller.abort();
    const error = await pending.catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AbortError");
    expect(error).not.toBeInstanceOf(DrugCentralError);
  });
});

describe("opt-in 5xx retry", () => {
  test("retries a 5xx and succeeds when maxRetries is set", async () => {
    const { requester, mock } = makeRequester(
      [{ status: 502, body: "Bad Gateway" }, [{ id: 7 }]],
      { maxRetries: 1 },
    );
    const data = await requester.get<{ id: number }[]>("structures");
    expect(data).toEqual([{ id: 7 }]);
    expect(mock.urls).toHaveLength(2);
  });

  test("does not retry by default", async () => {
    const { requester, mock } = makeRequester([{ status: 500, body: "boom" }]);
    const error = await requester.get("structures").catch((e) => e);
    expect(error).toBeInstanceOf(DrugCentralApiError);
    expect(mock.urls).toHaveLength(1);
  });

  test("gives up after maxRetries exhausted", async () => {
    const { requester, mock } = makeRequester([{ status: 500, body: "boom" }], {
      maxRetries: 2,
    });
    const error = await requester.get("structures").catch((e) => e);
    expect(error).toBeInstanceOf(DrugCentralApiError);
    expect(mock.urls).toHaveLength(3);
  });

  test("never retries a 4xx", async () => {
    const { requester, mock } = makeRequester([{ status: 404, body: "nope" }], {
      maxRetries: 3,
    });
    await requester.get("structures").catch(() => {});
    expect(mock.urls).toHaveLength(1);
  });

  test("backs off between retries", async () => {
    const { requester } = makeRequester([{ status: 500, body: "x" }], {
      maxRetries: 1,
    });
    const start = Date.now();
    await requester.get("structures").catch(() => {});
    expect(Date.now() - start).toBeGreaterThanOrEqual(200);
  });
});

describe("fetch availability", () => {
  test("throws DrugCentralError when no fetch exists and none is injected", async () => {
    const original = globalThis.fetch;
    // biome-ignore lint/suspicious/noExplicitAny: test mutates the global
    (globalThis as any).fetch = undefined;
    try {
      expect(() => new DrugCentralRequester({ baseUrl: BASE })).toThrow(
        DrugCentralError,
      );
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: test mutates the global
      (globalThis as any).fetch = original;
    }
  });
});

describe("default timeout constant", () => {
  test("is 30 seconds", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
  });
});

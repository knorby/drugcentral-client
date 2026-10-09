import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  INITIAL_BACKOFF_MS,
  MAX_RETRIES_DEFAULT,
} from "./constants";
import {
  DrugCentralApiError,
  DrugCentralError,
  DrugCentralInvalidResponseError,
  DrugCentralNetworkError,
  DrugCentralNotFoundError,
  DrugCentralTimeoutError,
} from "./errors";
import { buildQueryString } from "./utils/serialize";

/** Query parameter values accepted by the requester. */
export type QueryParamValue = string | number | undefined;

/**
 * A `fetch`-compatible function. The DrugCentral client uses the standard Web
 * `fetch` (native in Node 18+, React Native, browsers, Bun, and Deno) and
 * accepts an override for polyfills, testing, or request interception.
 */
export type FetchLike = typeof globalThis.fetch;

/** Configuration accepted by {@link DrugCentralRequester} and the client. */
export interface DrugCentralClientConfig {
  /**
   * Base URL for the DrugCentral DRS API. Defaults to the production host
   * observed 2026-10-03 (`https://uxn2ycvimg.us-east-2.awsapprunner.com`) —
   * an App Runner deployment that may change; check DrugCentral's site API
   * link and override here when needed.
   */
  baseUrl?: string;
  /**
   * Per-request timeout in milliseconds. Requests that exceed this are
   * aborted via `AbortSignal` and reject with a
   * {@link DrugCentralTimeoutError}.
   * @default 30000
   */
  timeoutMs?: number;
  /**
   * Custom `fetch` implementation. Inject a polyfill in older runtimes, a
   * `vi.fn`/mock in tests, or a wrapper that adds telemetry.
   */
  fetch?: FetchLike;
  /**
   * Extra headers merged into every request (e.g. `User-Agent`).
   */
  headers?: Record<string, string>;
  /**
   * Default `User-Agent` header. Some servers/proxies require one. Defaults
   * to `@knorby/drugcentral-client/<version>`; the version is resolved at
   * build time when available.
   *
   * @note Browsers treat `User-Agent` as a forbidden header and silently
   *   strip it, so the value is only sent in runtimes that allow setting it.
   */
  userAgent?: string;
  /**
   * Opt-in bounded retry for 5xx responses (DrugCentral transiently returns
   * non-JSON "Internal…" 5xx bodies). Retries wait `250ms · 2^attempt`
   * between attempts; `timeoutMs` applies per attempt, not to the total.
   * Consumer aborts are never retried.
   *
   * @default 0
   */
  maxRetries?: number;
}

/** Resolved after `ms` milliseconds (0 resolves on the next tick). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Low-level DrugCentral HTTP requester. Holds shared config and exposes
 * `get` (parsed JSON) and `getText` (raw body) methods that build the URL,
 * apply the timeout, perform the `fetch`, and map failures to typed errors.
 */
export class DrugCentralRequester {
  readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchLike;
  private readonly headers: Record<string, string>;
  private readonly maxRetries: number;

  constructor(config: DrugCentralClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const lower = (keys: Record<string, string> | undefined) =>
      Object.fromEntries(
        Object.entries(keys ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
      );
    // Header keys are normalized to lowercase (case-insensitive per the
    // `Headers` spec); later entries win, so config overrides defaults.
    this.headers = {
      accept: "application/json",
      "user-agent": config.userAgent ?? DEFAULT_USER_AGENT,
      ...lower(config.headers),
    };
    this.maxRetries = config.maxRetries ?? MAX_RETRIES_DEFAULT;
    if (!Number.isSafeInteger(this.maxRetries) || this.maxRetries < 0) {
      throw new RangeError("maxRetries must be a nonnegative integer");
    }

    // Typed as always-present, but absent in runtimes without global `fetch`.
    const globalFetch = globalThis.fetch as FetchLike | undefined;
    // A detached `globalThis.fetch` throws `TypeError: Illegal invocation` in
    // browsers (Web IDL requires the global receiver), so bind it. Injected
    // implementations are used as-is.
    const fetchImpl = config.fetch ?? globalFetch?.bind(globalThis);
    if (typeof fetchImpl !== "function") {
      throw new DrugCentralError(
        "No `fetch` implementation available. This runtime does not expose a global `fetch`. " +
          "Pass one via the client config, e.g. `createDrugCentralClient({ fetch: myFetch })`.",
      );
    }
    this.fetchFn = fetchImpl;
  }

  /**
   * Performs a `GET` request and returns the parsed JSON body.
   *
   * @param path Path relative to the base URL (e.g. `"structures"` or
   *   `"omop_relationship/struct_id/5391"`).
   * @param params Query parameters (serialized by {@link buildQueryString}).
   * @param signal Consumer abort signal; an abort re-throws the original
   *   abort error unwrapped.
   * @throws {DrugCentralApiError} for non-2xx responses (after any opt-in
   *   5xx retries are exhausted).
   * @throws {DrugCentralInvalidResponseError} for a 2xx non-JSON body.
   * @throws {DrugCentralTimeoutError} when the request exceeds `timeoutMs`.
   * @throws {DrugCentralNetworkError} for transport-level failures.
   */
  async get<TR>(
    path: string,
    params?: Record<string, QueryParamValue>,
    signal?: AbortSignal,
  ): Promise<TR> {
    return this.request(path, params, signal, async (response) => {
      const text = await response.text();
      if (!response.ok) {
        throw this.apiError(
          response.status,
          text,
          response.url || this.buildUrl(path, params),
        );
      }
      try {
        return JSON.parse(text) as TR;
      } catch {
        throw new DrugCentralInvalidResponseError({
          url: response.url || this.buildUrl(path, params),
          body: text,
        });
      }
    });
  }

  /**
   * Performs a `GET` request and returns the raw body text (for the API's
   * CSV/TSV export endpoints). The same error mapping as {@link get} applies,
   * minus JSON parsing.
   */
  async getText(
    path: string,
    params?: Record<string, QueryParamValue>,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.request(path, params, signal, (response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw this.apiError(
            response.status,
            text,
            response.url || this.buildUrl(path, params),
          );
        });
      }
      return response.text();
    });
  }

  /** Builds the full URL for a path and query parameters. */
  buildUrl(path: string, params?: Record<string, QueryParamValue>): string {
    const query = params ? buildQueryString(params) : "";
    return query
      ? `${this.baseUrl}/${path}?${query}`
      : `${this.baseUrl}/${path}`;
  }

  /**
   * Maps a non-2xx status to a typed error: 404s become
   * {@link DrugCentralNotFoundError} (DrugCentral's no-match behavior),
   * everything else a plain {@link DrugCentralApiError}.
   */
  private apiError(
    status: number,
    body: string,
    url: string,
  ): DrugCentralApiError {
    return status === 404
      ? new DrugCentralNotFoundError({ body, url })
      : new DrugCentralApiError({ status, body, url });
  }

  /**
   * Shared request loop: timeout handling, consumer-abort passthrough,
   * opt-in 5xx retry with backoff, and typed error mapping.
   */
  private async request<TR>(
    path: string,
    params: Record<string, QueryParamValue> | undefined,
    signal: AbortSignal | undefined,
    handle: (response: Response) => Promise<TR>,
  ): Promise<TR> {
    const url = this.buildUrl(path, params);

    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.timeoutMs);
      // Propagate a consumer abort to the in-flight fetch with its reason.
      const onConsumerAbort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", onConsumerAbort);
      try {
        const response = await this.fetchFn(url, {
          method: "GET",
          headers: this.headers,
          signal: controller.signal,
        });
        if (response.status >= 500 && attempt < this.maxRetries) {
          // Release the unread body so the connection is not pinned until GC.
          await response.body?.cancel();
          await sleep(INITIAL_BACKOFF_MS * 2 ** attempt);
          continue;
        }
        return await handle(response);
      } catch (error) {
        // A consumer-initiated abort always surfaces unwrapped, even if it
        // raced the timeout timer.
        if (signal?.aborted) throw signal.reason;
        if (timedOut) throw new DrugCentralTimeoutError(this.timeoutMs);
        if (error instanceof DrugCentralError) throw error;
        throw new DrugCentralNetworkError(url, error);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onConsumerAbort);
      }
    }
  }
}

/** Default DrugCentral DRS API base URL (App Runner host observed 2026-10-03). */
export const DEFAULT_BASE_URL = "https://uxn2ycvimg.us-east-2.awsapprunner.com";

/** Default per-request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default page size used by the client's auto-pagination helpers. */
export const DEFAULT_PAGE_SIZE = 100;

/** Default `User-Agent` sent where the runtime allows setting it. */
export const DEFAULT_USER_AGENT = `@knorby/drugcentral-client/${
  typeof PKG_VERSION !== "undefined" ? PKG_VERSION : "0.0.0"
}`;

/** Default number of 5xx retries (opt-in; `0` disables retrying). */
export const MAX_RETRIES_DEFAULT = 0;

/** Base backoff (ms) for the opt-in 5xx retry; doubles per attempt. */
const INITIAL_BACKOFF_MS = 250;

export { INITIAL_BACKOFF_MS };

/** Package version, injected at build time by tsup's `define` config. */
declare const PKG_VERSION: string | undefined;

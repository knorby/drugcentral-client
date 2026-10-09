# AGENTS.md

Instructions and steering for AI coding agents working in this repository.

`@knorby/drugcentral-client` is a fully-typed, zero-dependency TypeScript
client for the [DrugCentral](https://drugcentral.org) API. Universal target:
Node, React Native, browsers, Bun, Deno — no Node-only APIs in `src/`.

Project notes:

- Deterministic tests never hit the network. Live smoke tests run only with
  `DRUGCENTRAL_LIVE_TESTS=1` (`npm run test:live`). Shape-drift tooling:
  `npm run drift:check` / `npm run drift:capture`.
- The upstream API host (`https://uxn2ycvimg.us-east-2.awsapprunner.com`,
  observed 2026-10-03) is an App Runner deployment and may change. It is
  caller-configurable via `baseUrl`; the default lives in `src/constants.ts`.
- The upstream OpenAPI declares no response schemas. `src/types/` is derived
  from sampled live payloads checked in under `tests/fixtures/`, snapshotted
  from `tests/fixtures/openapi.json` (hash in `tests/fixtures/openapi.meta.json`).
- DrugCentral data is CC BY-SA 4.0; this code is Apache-2.0. The README
  carries required attribution, license separation, and the no-medical-advice
  disclaimer — keep them intact on any rewrite.
- Known upstream quirks the client handles explicitly: some filtered
  endpoints ignore `limit`; transient non-JSON 5xx bodies occur; there is no
  version endpoint (source version is "not supplied", never invented).

---

## Setup

### System requirements

Before installing git hooks, ensure the following are available on the
system:

1. **Node.js 24 (LTS)** — use [nvm](https://github.com/nvm-sh/nvm) or
   [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`.
2. **npm** — bundled with Node.
3. **pre-commit** — install via `pipx install pre-commit` or
   `brew install pre-commit`. Handles file hygiene + secret scanning.
4. **gitleaks** — install via `brew install gitleaks` or see
   <https://github.com/gitleaks/gitleaks>. The hook uses the
   system-installed binary (`gitleaks-system` hook ID) for lightweight
   regex-based secret scanning.
5. **Go toolchain** — required for the TruffleHog hook, which pre-commit
   builds from source in an isolated GOPATH on first run (slow; cached
   afterward). Install via `brew install go` or see <https://go.dev/dl/>.
6. **shellcheck** is **not** a system dependency — `shellcheck-py` ships its
   own bundled binary.

### Install dependencies and hooks

```bash
nvm use                  # or: fnm use
npm install              # installs deps (does NOT run prepare — see .npmrc)
npx husky                # set up Husky hooks (blocked by ignore-scripts)
pre-commit install       # wire pre-commit hooks into .git/hooks/
pre-commit run --all-files  # validate against the entire repo
```

`npm install` does **not** run the `prepare` script because `.npmrc` sets
`ignore-scripts=true` (supply-chain security — blocks dependency postinstall
scripts). Run `npx husky` separately to set up the Husky-managed hooks
(pre-commit → lint-staged, commit-msg → commitlint). `pre-commit install`
separately sets up the pre-commit-managed hooks (file hygiene + secret
scanning). Both are needed for full coverage.

### Adding and removing hooks

- **Prefer existing hooks.** Always check the pre-commit hooks index
  (<https://pre-commit.com/hooks.html>) and the featured repositories
  (<https://pre-commit.com/hooks.html#featured-hooks>) before writing a custom
  hook. Existing, maintained hooks are preferred over custom ones.
- **If no existing hook can satisfy a requirement**, flag this in your output
  and request input before adding a custom hook.
- **TypeScript linting/formatting** is handled by **Biome** via Husky +
  lint-staged (see `.husky/pre-commit`). Do not add a TS linter to
  `.pre-commit-config.yaml`; use Husky/lint-staged for that.
- **TruffleHog**: replaceable with another secret scanner if preferred. Both
  gitleaks and TruffleHog run in pre-commit. If CI-based secret scanning is
  also desired (e.g. to catch secrets when hooks are skipped), add a workflow
  in `.github/workflows/` and document it here.
- **Hook revisions** are pinned. Bump deliberately and review changelogs.
- Reference: <https://pre-commit.com/hooks.html>

---

## Development commands

| Command | What it does |
| --- | --- |
| `npm run build` | Build the package (tsup + tsc — dual ESM/CJS output with `.d.ts`/`.d.cts` declarations) |
| `npm run dev` | Build in watch mode |
| `npm run lint` | Lint + formatting check with Biome (read-only) |
| `npm run format` | Format with Biome (writes changes) |
| `npm run check` | Lint + format in one pass (writes changes) |
| `npm run typecheck` | Type-check `src/` + `tests/` with `tsc` (uses `tsconfig.test.json`, no emit) |
| `npm run changeset:check` | Parse every changeset without requiring Git base refs or a new release bump |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage reporting |
| `npm run test:live` | Opt-in live smoke tests against the real DrugCentral API (`DRUGCENTRAL_LIVE_TESTS=1`) |
| `npm run drift:capture` | Capture upstream response shapes into `tests/shapes/` |
| `npm run drift:check` | Fail if captured upstream shapes differ from the snapshots |
| `npm run pack:check` | Validate dry-run package contents, version, and ESM/CJS entry points (build first) |
| `npx changeset` | Create a changeset (required for any change that affects published output) |

---

## Testing and CI

- Tests live in `tests/` and use **Vitest**. Add test files as
  `*.test.ts` alongside or under `tests/`.
- **GitHub Actions** runs the full check suite on every push to `main` and on
  PRs against `main` (see `.github/workflows/tests.yml`):
  - `npm run lint` (Biome — lint + formatting; formatting is enforced in CI,
    so run `npm run check` before committing if hooks are skipped)
  - `npm run typecheck` (tsc, src + tests)
  - `npm run changeset:check` (parse every changeset, including on version PRs)
  - `npm run build` (tsup)
  - `npm test` (Vitest)
  - `npm audit --audit-level=moderate` (vulnerability scan)
  - `npm run pack:check` (package whitelist + required public entry points)
- Tests and Pre-commit also support `workflow_dispatch`, so a maintainer can
  check the latest commit on a bot-created version PR's branch. GitHub's default
  workflow token does not automatically trigger checks on those PRs.
- CI uses the parsing-only Changesets check. `changeset status` also enforces
  release intent against a Git base ref, so it is an owner review command,
  not a gate for version PRs after their changesets have been consumed.
- The **pre-commit suite** (file hygiene + secret scanning) also runs in CI
  via `.github/workflows/pre-commit.yml` on every push to `main` and PRs
  against `main` (`pre-commit run --all-files --show-diff-on-failure` with
  `SKIP=no-commit-to-branch`, which would otherwise always fail on main pushes
  by design). The workflow installs a system gitleaks binary matching the rev
  in `.pre-commit-config.yaml`; the trufflehog golang hook uses the Go
  toolchain preinstalled on ubuntu-latest.
- Husky hooks (Biome + commitlint) remain local only.
- Optional security scanning additions (free for public repos): CodeQL
  (<https://github.com/github/codeql-action>), gitleaks-action
  (<https://github.com/gitleaks/gitleaks-action>), Semgrep
  (<https://github.com/returntocorp/semgrep-action>). Add workflows in
  `.github/workflows/` if desired and document them here.

---

## Versioning and publishing

This repo uses [Changesets](https://github.com/changesets/changesets) for
versioning. Versioning is **decoupled from merges** — you can merge multiple
PRs and release them all at once.

- **Before a PR that changes published output**: run `npx changeset`, select
  bump type (patch/minor/major), write a summary. Commit the generated
  `.changeset/*.md` file alongside the code change.
- **To release**: `npx changeset version` (bumps `package.json` +
  `CHANGELOG.md`), then `npm run release` (builds + publishes).
- **Initial 0.1.0** is already versioned in `package.json`, the lockfile, and
  `CHANGELOG.md`. Fold pre-publish refinements into that changelog entry; keep
  the empty release-preparation changeset instead of scheduling another bump.
- **GitHub Actions release** (`workflow-templates/release.yml`) is **staged**.
  Activate it in a follow-up PR only after the repo is public and merged main's
  0.1.0 has been published manually. The ordered owner runbook lives in
  [README → Releasing](README.md#releasing); read it before changing release
  setup, seeding npm, or activating the workflow.
- **Once active**, non-empty changesets create a Version Packages PR. Only
  empty changesets select no-op. With no changesets, an unpublished package
  version selects publish; a version already on npm selects no-op. Publishing
  runs its own lint/typecheck/build/test/audit/Changesets/content gates rather
  than relying on another workflow. Only the publish job receives OIDC rights.
- **Publishing boundaries:** workflow runs are restricted to `main`; the owner
  must also restrict the GitHub `release` environment to `main`. Dependencies
  are uncached in release jobs and third-party Changesets actions are SHA-pinned.
- **Trusted publisher:** configure `knorby`, `drugcentral-client`, filename
  `release.yml`, environment `release`, and allow direct `npm publish`. A new
  configuration must complete its first publish within two days. Configure it
  close to the next real release, not at a no-op workflow activation. Enable
  Actions PR creation; keep default token permissions read-only.
- **Initial local publish:** build and run the gates first, then use
  `npm publish --access public --tag latest --provenance=false` from clean,
  merged main. This overrides provenance for one invocation without modifying
  `package.json`. Confirm npm publication before creating/pushing `v0.1.0` and
  the GitHub Release. Local 0.1.0 has no CI provenance and cannot be overwritten.
- **Package contents:** `npm run pack:check` enforces `dist/`, `README.md`,
  `CHANGELOG.md`, `LICENSE`, and npm's automatically included `package.json`,
  including both bundle and declaration entry points. Build before packing.

### Release failure quick reference

| Symptom | Likely cause / fix |
| --- | --- |
| `EOTP` errors | A token is being used on a 2FA-enabled account — trusted publishing (no token) avoids this |
| `ENEEDAUTH` / 401 on publish | npm < 11.5.1, mismatched repo/workflow/environment, an expired trusted publisher, or missing direct-publish permission |
| "not permitted to create pull requests" | Enable "Allow GitHub Actions to create and approve pull requests" in Actions settings |
| Provenance warning `provider: null` | Published locally instead of via CI — provenance only works from CI on a public repo |
| 404 "package not found" right after publishing | npm registry replication lag — retry in a minute |

### Publishing security

- **Trusted publishing (OIDC)** — the release workflow publishes with an OIDC
  token minted by GitHub Actions; there are no npm tokens involved (no
  `NPM_TOKEN` or `NODE_AUTH_TOKEN` secrets). The npm-side trusted-publisher
  config must match the workflow exactly. This is compatible with 2FA
  (`npm profile enable-2fa auth-and-writes`) because no token needs an OTP.
- **Provenance** — `publishConfig.provenance: true` in `package.json` enables
  npm provenance attestation (cryptographic link to commit + workflow).
  Provenance requires publishing from CI on a **public** repository; the
  manual first publish overrides it with `--provenance=false`; keep the
  committed configuration unchanged. Future OIDC releases generate provenance.
- **Scoped names** — `@knorby/…` scoped names prevent dependency confusion
  attacks. Scoped packages default to restricted visibility, so
  `publishConfig.access: "public"` is set.
- **No secrets in published files** — the `files` field in `package.json`
  whitelists `dist`, `README.md`, `CHANGELOG.md`, and `LICENSE` (npm also
  includes `package.json`). Keep `src/`, `.env`, `tsconfig.json`, and other
  configuration out of the `files` list.
- **`.npmrc`** — `ignore-scripts=true` blocks dependency `postinstall`
  scripts by default (supply-chain security). This also blocks this repo's
  own `prepare` script, so `npm install` will not auto-set-up Husky hooks —
  run `npx husky` after `npm install`, or use
  `npm install --ignore-scripts=false` to allow the prepare script.

---

## Guardrails and steering rules

These rules are mandatory. Follow them strictly.

### Git operations

- Do **not** perform git write operations — `commit`, `push`, `amend`, `tag`,
  create PRs — unless explicitly asked by the user.

### File removal

- `rm` is intentionally blocked in this environment. Do **not** attempt to
  bypass this restriction (no `find -delete`, `python -c "os.remove(...)"`,
  shell tricks, or alternative deletion methods).
- Use `git rm` for tracked files that need removal.
- If untracked files need removal, or if your action is required to remove
  something, **stop** and flag what needs to be removed and why in your output.

### Documentation

- Keep `AGENTS.md` and `README.md` up to date as part of any change that
  affects setup, conventions, or project structure.
- `docs/superpowers/` (plans, specs) and `.superpowers/` are **local
  scratch, gitignored by design** — never commit them.
- There is no tracked `docs/` tree; put usage knowledge in `README.md` and
  conventions here.

### Data and medical disclaimers

- DrugCentral is the data source (CC BY-SA 4.0); this package is code only
  (Apache-2.0). Do not remove or weaken the README's attribution, license
  separation, or no-medical-advice disclaimer.
- Sampled response fixtures in `tests/fixtures/` are DrugCentral data, not
  Apache-2.0 code. Preserve their attribution README and per-response metadata;
  keep fixtures out of npm output. The OpenAPI snapshot is separately identified
  as an upstream API description.
- The client never invents upstream facts: absent fields stay absent,
  `relationship_name` labels stay verbatim, FAERS numbers are signals (not
  incidence), and no version metadata is fabricated.

### Before declaring done

- Run all quality gates:
  ```bash
  npm run lint && npm run typecheck && npm run build && npm test && npm audit --audit-level=moderate && npm run changeset:check && npm run pack:check
  ```
- Build before tests: the public-surface tests read generated declarations.
- Verify that `npm pack --dry-run` includes only `dist/`, `README.md`,
  `CHANGELOG.md`, `LICENSE`, and the mandatory `package.json` (no fixtures,
  source files, extra configuration, or secrets).
- Verify that `AGENTS.md` and `README.md` still reflect the current state of
  the repository.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const requiredFiles = [
  "package.json",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "dist/index.js",
  "dist/index.cjs",
  "dist/index.d.ts",
  "dist/index.d.cts",
];

function checkPack(paths: string[], version = manifest.version) {
  return spawnSync(process.execPath, ["scripts/check-package.mjs", "--stdin"], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify([
      {
        name: manifest.name,
        version,
        files: paths.map((path) => ({ path })),
      },
    ]),
  });
}

describe("release metadata", () => {
  test("the lockfile identifies the same version as the published manifest", () => {
    const lock = JSON.parse(
      readFileSync(join(root, "package-lock.json"), "utf8"),
    );
    expect(lock.version).toBe(manifest.version);
    expect(lock.packages[""].version).toBe(manifest.version);
  });
});

describe("package-content gate", () => {
  test("accepts the public entry points and documented package files", () => {
    const result = checkPack([...requiredFiles, "dist/types/omop.d.ts"]);
    expect(result.status, result.stderr).toBe(0);
  });

  test.each([
    ".env",
    "src/index.ts",
    "tests/fixtures/structures.json",
    "tsconfig.json",
  ])("rejects an unexpected packed file: %s", (path) => {
    const result = checkPack([...requiredFiles, path]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unexpected packed files");
  });

  test("rejects an incomplete build missing CommonJS declarations", () => {
    const result = checkPack(
      requiredFiles.filter((path) => path !== "dist/index.d.cts"),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing required packed files");
  });

  test("rejects a package report for the wrong release version", () => {
    const result = checkPack(requiredFiles, "0.0.0");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Packed package identity");
  });

  test("rejects empty input instead of masking a failed pack command", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-package.mjs", "--stdin"],
      { cwd: root, encoding: "utf8", input: "" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Package check failed");
  });
});

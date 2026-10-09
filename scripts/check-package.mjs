import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Validate a real npm dry-run by default; --stdin also accepts a saved pack
// report so the same gate can inspect artifacts without invoking npm again.
try {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const report = JSON.parse(
    process.argv.includes("--stdin")
      ? readFileSync(0, "utf8")
      : execFileSync(
          "npm",
          ["pack", "--dry-run", "--json", "--ignore-scripts"],
          {
            encoding: "utf8",
          },
        ),
  );
  if (!Array.isArray(report) || report.length !== 1) {
    throw new Error("Expected exactly one packed package");
  }
  const [pack] = report;
  if (pack.name !== manifest.name || pack.version !== manifest.version) {
    throw new Error("Packed package identity does not match package.json");
  }
  if (!Array.isArray(pack.files)) {
    throw new Error("Missing packed file list");
  }
  const allowedRootFiles = [
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
  ];
  const requiredFiles = [
    ...allowedRootFiles,
    "dist/index.js",
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/index.d.cts",
  ];
  const paths = pack.files.map(({ path }) => path);
  const unexpected = paths.filter(
    (path) =>
      typeof path !== "string" ||
      path.includes("\\") ||
      path.split("/").some((part) => part === ".." || part === ".") ||
      (!allowedRootFiles.includes(path) && !path.startsWith("dist/")),
  );
  if (unexpected.length > 0) {
    throw new Error(`Unexpected packed files: ${unexpected.join(", ")}`);
  }
  const missing = requiredFiles.filter((path) => !paths.includes(path));
  if (missing.length > 0) {
    throw new Error(`Missing required packed files: ${missing.join(", ")}`);
  }
  console.log(
    `Package check passed: ${pack.name}@${pack.version}, ${paths.length} files`,
  );
} catch (error) {
  console.error("Package check failed:", error.message);
  process.exitCode = 1;
}

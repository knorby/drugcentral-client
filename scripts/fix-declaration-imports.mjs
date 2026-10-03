// Build post-step: rewrites extensionless relative import specifiers in the
// tsc-emitted declaration files to explicit ".js" paths.
//
// Why: `tsc --emitDeclarationOnly` emits `from "./client"` (extensionless),
// which `moduleResolution: "node16"`/`"nodenext"` consumers reject with
// TS2834. The runtime bundles are self-contained (tsup inlines everything),
// so the ".js" suffix is purely a types-resolution hint: TypeScript maps
// "./client.js" to "./client.d.ts", which ships alongside it in dist/.
//
// tsup's own `dts: true` (rollup-plugin-dts) would produce a single
// self-contained declaration file but is incompatible with TypeScript 7
// (see ADR-0002), hence this focused rewrite. Runs as part of `npm run build`.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Matches `from "./path"`, `from '../path'`, and `import("./path")` where the
// specifier is relative and has no extension (`.js`/`.cjs`/`.mjs` left alone).
const SPECIFIER = /(\bfrom\s*(["'])(\.\.?\/[^"'.]+)\2|\bimport\(\s*(["'])(\.\.?\/[^"'.]+)\4)/g;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

let files = 0;
let specifiers = 0;
for await (const file of walk("dist")) {
  const source = await readFile(file, "utf8");
  const out = source.replace(SPECIFIER, (match) => {
    specifiers += 1;
    return match.replace(/(["'])(\.\.?\/[^"'.]+)\1/, "$1$2.js$1");
  });
  if (out !== source) {
    await writeFile(file, out);
    files += 1;
  }
}
console.log(`fix-declaration-imports: rewrote ${specifiers} specifier(s) in ${files} file(s)`);

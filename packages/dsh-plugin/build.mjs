import { build } from "esbuild";
import {
  mkdir,
  writeFile,
  chmod,
  readFile,
  readdir,
  appendFile,
} from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
const bundledInputs = new Set();
const requireBanner =
  'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);';
await mkdir("dist", { recursive: true });
for (const [entry, output] of [
  ["src/host.js", "host.js"],
  ["src/worker-cli.js", "worker.js"],
]) {
  const built = await build({
    entryPoints: [entry],
    outfile: `dist/${output}`,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    banner: {
      js:
        (output === "worker.js" ? "#!/usr/bin/env node\n" : "") + requireBanner,
    },
    logLevel: "warning",
    metafile: true,
  });
  for (const input of Object.keys(built.metafile.inputs))
    if (input.includes("node_modules/")) bundledInputs.add(resolve(input));
}
const client = await build({
  entryPoints: ["src/client.jsx"],
  bundle: true,
  write: false,
  platform: "browser",
  format: "cjs",
  target: "es2022",
  external: ["react", "@deepseek-ai/dsh-client-ui-primitives"],
  loader: { ".css": "text" },
  logLevel: "warning",
});
await writeFile(
  "dist/client.js",
  `window.__ModuleLoader__.load({id:'@pamiya/dsh-plugin',factory(require){const module={exports:{}};const exports=module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;}});\n`,
);
const packages = new Map();
for (const input of bundledInputs) {
  let directory = dirname(input);
  while (directory !== dirname(directory)) {
    try {
      const metadata = JSON.parse(
        await readFile(join(directory, "package.json"), "utf8"),
      );
      if (metadata.name && metadata.version) {
        const key = `${metadata.name}@${metadata.version}`;
        if (!packages.has(key)) {
          const names = (await readdir(directory)).filter((name) =>
            /^licen[cs]e(?:[.-]|$)/i.test(name),
          );
          const sdkLicense =
            !names.length &&
            metadata.license === "Apache-2.0" &&
            String(metadata.repository?.url).includes(
              "github.com/aws/aws-sdk-js-v3",
            )
              ? await readFile(
                  new URL(
                    "../../node_modules/@aws-sdk/client-s3/LICENSE",
                    import.meta.url,
                  ),
                  "utf8",
                )
              : null;
          if (!names.length && !sdkLicense)
            throw new Error(`Missing distribution license for ${key}`);
          const notices = sdkLicense
            ? [sdkLicense]
            : await Promise.all(
                names.map((name) => readFile(join(directory, name), "utf8")),
              );
          packages.set(
            key,
            `## ${key} (${metadata.license ?? "see notice"})\n\n${notices.join("\n")}`,
          );
        }
        break;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    directory = dirname(directory);
  }
}
const ownLicense = await readFile("LICENSE", "utf8");
const notices =
  "# Pamiya and bundled third-party licenses\n\n## Pamiya — Apache-2.0\n\n" +
  ownLicense +
  "\n\n" +
  [...packages.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, notice]) => notice)
    .join("\n\n");
await writeFile("dist/THIRD_PARTY_NOTICES.md", notices);
for (const output of ["dist/host.js", "dist/worker.js"])
  await appendFile(
    output,
    "\n/*\n" + notices.replaceAll("*/", "* /") + "\n*/\n",
  );
await chmod("dist/worker.js", 0o755);
console.log("Built DSH Host plugin, client plugin and standalone Worker.");

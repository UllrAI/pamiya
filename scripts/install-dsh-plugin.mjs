import { patchProfile } from "./dsh-profile.mjs";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    dsh: { type: "string" },
    profile: { type: "string", default: "desktop" },
    demo: { type: "boolean", default: false },
  },
});
if (!/^[a-zA-Z0-9_-]+$/.test(values.profile))
  throw new Error("Invalid DSH profile name");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status})`);
}
const bundled =
  "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh";
const cli = values.dsh ?? (existsSync(bundled) ? bundled : "dsh");
run("npm", ["run", "plugin:build"]);
await mkdir(resolve(root, "artifacts"), { recursive: true });
run("npm", [
  "pack",
  "--workspace",
  "@pamiya/dsh-plugin",
  "--pack-destination",
  "artifacts",
]);
const manifest = JSON.parse(
  await readFile(resolve(root, "packages/dsh-plugin/package.json"), "utf8"),
);
const source = resolve(
  root,
  `artifacts/pamiya-dsh-plugin-${manifest.version}.tgz`,
);
const revision = createHash("sha256")
  .update(await readFile(source))
  .digest("hex")
  .slice(0, 12);
const home = resolve(process.env.DSH_HOME || resolve(homedir(), ".dsh"));
const packages = resolve(home, "pamiya", "packages");
await mkdir(packages, { recursive: true, mode: 0o700 });
const target = resolve(packages, `pamiya-dsh-plugin-${revision}.tgz`);
await copyFile(source, target);
run(cli, ["plugin", "--profile", values.profile, "add", target]);
const patch = resolve(home, "profiles", values.profile, "cordis.patch.yml");
const original = await readFile(patch, "utf8");
const next = patchProfile(original, { revision, demo: values.demo });
const backup = resolve(home, "pamiya-install-backups", `${Date.now()}`);
await mkdir(backup, { recursive: true, mode: 0o700 });
await copyFile(patch, resolve(backup, "cordis.patch.yml"));
await writeFile(patch, next, { mode: 0o600 });
console.log(
  `Pamiya installed in ${values.profile}; source package retained at ${target}. Existing settings backed up. Reload DSH if the client does not refresh automatically.`,
);

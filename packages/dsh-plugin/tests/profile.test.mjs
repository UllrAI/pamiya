import test from "node:test";
import assert from "node:assert/strict";
import { patchProfile } from "../../../scripts/dsh-profile.mjs";
import * as yaml from "js-yaml";

test("first install handles DSH comment-prefixed empty YAML profiles", () => {
  const original = "# User overrides\n# Keep this comment\n[]\n";
  const result = patchProfile(original, {
    revision: "abcdef123456",
    demo: true,
  });
  assert.match(result, /# Keep this comment/);
  const parsed = yaml.load(result);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].config.bootstrapDemo, true);
});
test("updates preserve unrelated profile overrides and reject user-owned Pamiya rows", () => {
  const original = "- id: models\n  config:\n    unchanged: value\n";
  const first = patchProfile(original, { revision: "aaa", demo: true });
  const second = patchProfile(first, { revision: "bbb", demo: false });
  assert.ok(second.startsWith(original));
  assert.equal(yaml.load(second).length, 2);
  assert.equal(yaml.load(second)[1].config.revision, "bbb");
  assert.throws(() =>
    patchProfile("- id: pamiya\n  config:\n    mine: true\n", {
      revision: "ccc",
    }),
  );
});

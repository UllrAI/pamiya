import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { SkillFileStore } from "../src/file-store.js";
import {
  encryptSkill,
  decryptSkill,
  downloadSkill,
} from "../src/file-download.js";
import { sampleBundle, makeBundle } from "../src/skills.js";
import { sharedModelCall } from "../src/model-gateway.js";

test("private Skills use S3 HTTPS signed references, not MQTT content, with per-worker encryption", async () => {
  const files = structuredClone(sampleBundle().files);
  files["assets/large.bin"] = randomBytes(3 * 1024 * 1024).toString("base64");
  const bundle = makeBundle(files, "large-skill"),
    key = randomBytes(32).toString("base64url"),
    objects = new Map();
  const config = {
    endpoint: "https://storage.example.test",
    region: "us-east-1",
    bucket: "pamiya-test",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    forcePathStyle: true,
  };
  const requestHandler = {
    handle: async (request) => {
      const id = request.path.split("?")[0];
      if (request.method === "PUT") objects.set(id, Buffer.from(request.body));
      return {
        response: { statusCode: 200, headers: {}, body: Readable.from([]) },
      };
    },
    destroy() {},
  };
  const store = await new SkillFileStore({
    home: "/unused",
    secrets: { get: async () => config },
    clientFactory: (value) => new S3Client({ ...value, requestHandler }),
  }).init();
  const reference = await store.reference({
    bundle,
    key,
    workerId: "worker-a",
    local: false,
    publicTest: false,
  });
  assert.equal(reference.transport, "https");
  assert.ok(
    JSON.stringify(reference).length < 4096,
    "MQTT carries only a small reference",
  );
  assert.match(reference.url, /X-Amz-Signature=/);
  assert.equal(reference.encrypted, true);
  assert.ok(!JSON.stringify(store.snapshot()).includes("test-secret"));
  const ciphertext = [...objects.values()][0];
  assert.ok(ciphertext.length > 3 * 1024 * 1024);
  assert.ok(!ciphertext.includes(Buffer.from("SKILL.md")));
  const received = await downloadSkill(reference, {
    key,
    hash: bundle.ref.hash,
    fetchImpl: async (url) => {
      assert.equal(new URL(url).protocol, "https:");
      return new Response(ciphertext);
    },
  });
  assert.equal(
    makeBundle(received.files, received.ref.id, false, received.executables).ref
      .hash,
    bundle.ref.hash,
  );
  assert.throws(() =>
    decryptSkill(
      ciphertext,
      randomBytes(32).toString("base64url"),
      bundle.ref.hash,
    ),
  );
  assert.throws(() => decryptSkill(ciphertext, key, "0".repeat(64)));
  await assert.rejects(
    downloadSkill({ transport: "local", path: "/personal" }, { local: false }),
    /不能访问/,
  );
  await assert.rejects(
    downloadSkill({ transport: "https", url: "http://storage.test" }, {}),
    /HTTPS/,
  );
  await assert.rejects(
    downloadSkill(reference, {
      key,
      hash: bundle.ref.hash,
      fetchImpl: async () => new Response("", { status: 403 }),
    }),
    /403/,
  );
});
test("public sample needs no storage account, while personal remote Skills require configured storage", async () => {
  const store = await new SkillFileStore({
    home: "/owned",
    secrets: { get: async () => undefined },
    publicBaseUrl: "https://example.test/samples",
  }).init();
  const bundle = sampleBundle();
  assert.equal(
    (await store.reference({ bundle, publicTest: true })).url,
    `https://example.test/samples/${bundle.ref.hash}.json`,
  );
  assert.equal(
    (await store.reference({ bundle, local: true })).transport,
    "local",
  );
  await assert.rejects(
    store.reference({ bundle, publicTest: false, local: false }),
    /文件中转/,
  );
});
test("shared DSH model preserves top-level identities for parallel tool results", async () => {
  let observed;
  const llm = {
    async *stream(request) {
      observed = request;
      yield { type: "finish", reason: { kind: "stop" } };
    },
  };
  const calls = [
    { type: "tool-call", id: "a", name: "read", arguments: "{}" },
    { type: "tool-call", id: "b", name: "read", arguments: "{}" },
  ];
  await sharedModelCall(
    llm,
    { provider: "test", model: "test" },
    {
      messages: [
        { role: "assistant", content: calls },
        {
          role: "tool",
          callId: "a",
          content: [{ type: "text", text: "first" }],
        },
        {
          role: "tool",
          callId: "b",
          content: [{ type: "text", text: "second" }],
        },
      ],
    },
    new AbortController().signal,
  );
  assert.deepEqual(
    observed.messages.filter((m) => m.role === "tool").map((m) => m.toolCallId),
    ["a", "b"],
  );
});

test("storage setup verifies a signed download before persisting credentials and retains valid config on failure", async () => {
  let saved,
    fail = false;
  const requests = [];
  const config = {
    endpoint: "https://storage.example.test",
    region: "us-east-1",
    bucket: "pamiya-test",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    forcePathStyle: true,
  };
  const store = await new SkillFileStore({
    home: "/unused",
    secrets: {
      get: async () => saved,
      set: async (_id, value) => {
        saved = structuredClone(value);
      },
    },
    clientFactory: (value) =>
      new S3Client({
        ...value,
        requestHandler: {
          async handle(request) {
            requests.push(request.method);
            return {
              response: {
                statusCode: 200,
                headers: {},
                body: Readable.from([]),
              },
            };
          },
          destroy() {},
        },
      }),
    fetchImpl: async (url) => {
      assert.match(url, /X-Amz-Signature=/);
      return new Response(fail ? "wrong" : "PAMIYA_FILE_CHANNEL_OK");
    },
  }).init();
  await store.save(config);
  assert.equal(store.snapshot().configured, true);
  assert.deepEqual(requests, ["PUT", "DELETE"]);
  assert.equal(saved.secretAccessKey, "test-secret");
  fail = true;
  await assert.rejects(
    store.save({ ...config, bucket: "wrong-bucket" }),
    /下载/,
  );
  assert.equal(store.snapshot().bucket, "pamiya-test");
  assert.equal(saved.bucket, "pamiya-test");
});

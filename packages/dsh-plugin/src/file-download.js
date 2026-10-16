import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
export const MAX_SKILL_DOWNLOAD = 92 * 1024 * 1024;
export function encryptSkill(bytes, key, hash) {
  const nonce = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(key, "base64url"),
      nonce,
    );
  cipher.setAAD(Buffer.from(`pamiya-skill-v1:${hash}`));
  const data = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), data]);
}
export function decryptSkill(bytes, key, hash) {
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64url"),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from(`pamiya-skill-v1:${hash}`));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]);
}
export async function downloadSkill(
  reference,
  { local = false, key, hash, signal, fetchImpl = fetch } = {},
) {
  if (reference.transport === "local") {
    if (!local) throw new Error("远端节点不能访问主机本地文件");
    return JSON.parse(await readFile(reference.path, "utf8"));
  }
  if (
    reference.transport !== "https" ||
    new URL(reference.url).protocol !== "https:"
  )
    throw new Error("Skill 文件需要 HTTPS 下载地址");
  signal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(600000),
  ]);
  let response;
  try {
    response = await fetchImpl(reference.url, { signal, redirect: "error" });
  } catch {
    signal?.throwIfAborted();
    throw new Error("无法下载 Skill 文件，请检查节点的 HTTPS 出站连接后重试");
  }
  if (!response.ok)
    throw new Error(
      `Skill 文件下载失败（HTTP ${response.status}），请重试准备`,
    );
  if (Number(response.headers.get("content-length")) > MAX_SKILL_DOWNLOAD)
    throw new Error("Skill 文件超过 64 MB 原始内容限制");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_SKILL_DOWNLOAD) {
      await response.body.cancel().catch(() => {});
      throw new Error("Skill 文件过大");
    }
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  return JSON.parse(
    (reference.encrypted ? decryptSkill(bytes, key, hash) : bytes).toString(),
  );
}

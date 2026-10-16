import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { encryptSkill } from "./file-download.js";
export const fileStorageSchema = z
  .object({
    endpoint: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    }, "请输入 HTTPS 存储端点"),
    region: z.string().min(1).max(100).default("us-east-1"),
    bucket: z.string().min(1).max(100),
    accessKeyId: z.string().min(1).max(300),
    secretAccessKey: z.string().max(2000).default(""),
    forcePathStyle: z.boolean().default(true),
  })
  .strict();
export class SkillFileStore {
  constructor({
    home,
    secrets,
    publicBaseUrl,
    clientFactory = (config) => new S3Client(config),
    fetchImpl = fetch,
  }) {
    this.home = home;
    this.secrets = secrets;
    this.publicBaseUrl = publicBaseUrl;
    this.clientFactory = clientFactory;
    this.fetch = fetchImpl;
  }
  async init() {
    this.config = await this.secrets.get("file-storage");
    return this;
  }
  snapshot() {
    if (!this.config) return { configured: false };
    const { endpoint, region, bucket, forcePathStyle, accessKeyId } =
      this.config;
    return {
      configured: true,
      endpoint,
      region,
      bucket,
      forcePathStyle,
      accessKeyId,
    };
  }
  client(config) {
    return this.clientFactory({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  async save(input) {
    const config = fileStorageSchema.parse(input);
    if (!config.secretAccessKey)
      config.secretAccessKey = this.config?.secretAccessKey ?? "";
    if (!config.secretAccessKey)
      throw new Error("请填写存储 Secret Access Key");
    const client = this.client(config),
      Key = `pamiya/checks/${randomUUID()}`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key,
          Body: "PAMIYA_FILE_CHANNEL_OK",
        }),
        { abortSignal: AbortSignal.timeout(20000) },
      );
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key }),
        { expiresIn: 60 },
      );
      const result = await this.fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!result.ok || (await result.text()) !== "PAMIYA_FILE_CHANNEL_OK")
        throw new Error("无法使用签名地址下载文件");
    } finally {
      await client
        .send(new DeleteObjectCommand({ Bucket: config.bucket, Key }), {
          abortSignal: AbortSignal.timeout(20000),
        })
        .catch(() => {});
      client.destroy();
    }
    await this.secrets.set("file-storage", config);
    this.config = config;
    return this.snapshot();
  }
  async reference({ bundle, workerId, key, local, publicTest, signal }) {
    if (local) {
      const path = resolve(
        this.home,
        "pamiya/skill-library/snapshots",
        `${bundle.ref.hash}.json`,
      );
      return { transport: "local", path };
    }
    if (publicTest) {
      if (!bundle.ref.synthetic || !this.publicBaseUrl)
        throw new Error("公共连接只允许内置合成文件");
      return {
        transport: "https",
        url: `${this.publicBaseUrl}/${bundle.ref.hash}.json`,
        encrypted: false,
      };
    }
    if (!this.config)
      throw new Error(
        "[PAMIYA_FILE_STORAGE_REQUIRED] 请先配置文件中转存储；在 Pamiya 的运行记录中打开本任务，选择“配置文件存储”。双方通过 HTTPS 出站连接，无需直连",
      );
    const client = this.client(this.config),
      Key = `pamiya/skills/${workerId}/${createHash("sha256").update(key).digest("hex").slice(0, 16)}/${bundle.ref.hash}.bin`;
    try {
      const bytes = encryptSkill(
        Buffer.from(JSON.stringify(bundle)),
        key,
        bundle.ref.hash,
      );
      await client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key,
          Body: bytes,
          ContentType: "application/octet-stream",
        }),
        { abortSignal: signal },
      );
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: this.config.bucket, Key }),
        { expiresIn: 900 },
      );
      return { transport: "https", url, encrypted: true };
    } finally {
      client.destroy();
    }
  }
}

import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { MiniS3Client } from "./mini-s3.ts";

/**
 * Interface chung cho mọi Storage Provider.
 * Bắt buộc tất cả Provider phải implement đủ 3 thao tác cơ bản.
 */
export interface IStorageProvider {
  upload(
    bucket: string,
    filePath: string,
    fileData: BodyInit | Uint8Array | Blob | File,
    mimeType?: string,
  ): Promise<string>;

  delete(bucket: string, filePath: string): Promise<void>;

  download(bucket: string, filePath: string): Promise<Uint8Array>;

  getPresignedPutUrl(
    bucket: string,
    filePath: string,
    expiresInSeconds?: number,
  ): Promise<string>;
}

// ─── Helper: Chuẩn hoá fileData về Uint8Array để xử lý nội bộ ──────────────
async function toUint8Array(
  fileData: BodyInit | Uint8Array | Blob | File,
): Promise<Uint8Array> {
  if (fileData instanceof Uint8Array) return fileData;
  if (fileData instanceof Blob) {
    return new Uint8Array(await fileData.arrayBuffer());
  }
  if (typeof fileData === "string") return new TextEncoder().encode(fileData);
  if (fileData instanceof ArrayBuffer) return new Uint8Array(fileData);
  if (fileData instanceof ReadableStream) {
    const reader = fileData.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }
  throw new Error(`Unsupported fileData type: ${typeof fileData}`);
}

/**
 * 1. LOCAL STORAGE: Lưu trữ trên ổ cứng của server
 */
export class LocalStorageProvider implements IStorageProvider {
  async upload(
    bucket: string,
    filePath: string,
    fileData: BodyInit | Uint8Array | Blob | File,
    _mimeType?: string,
  ): Promise<string> {
    const dir = `./uploads/${bucket}`;
    const dest = `${dir}/${filePath}`;
    const parentDir = dest.substring(0, dest.lastIndexOf("/"));
    await Deno.mkdir(parentDir, { recursive: true });
    await Deno.writeFile(dest, await toUint8Array(fileData));
    logger.info(`✅ Uploaded file to Local Storage: ${dest}`);
    return `/uploads/${bucket}/${filePath}`;
  }

  async delete(bucket: string, filePath: string): Promise<void> {
    await Deno.remove(`./uploads/${bucket}/${filePath}`);
    logger.info(`🗑 Deleted from Local Storage: ${bucket}/${filePath}`);
  }

  download(bucket: string, filePath: string): Promise<Uint8Array> {
    return Deno.readFile(`./uploads/${bucket}/${filePath}`);
  }

  // Local storage không hỗ trợ presigned URL
  getPresignedPutUrl(_bucket: string, _filePath: string): Promise<string> {
    return Promise.reject(
      new Error("Local Storage does not support presigned URLs."),
    );
  }
}

/**
 * 2. SUPABASE STORAGE: Gửi HTTP trực tiếp qua REST API của Supabase
 */
export class SupabaseStorageProvider implements IStorageProvider {
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor() {
    this.baseUrl = config.supabaseUrl?.replace(/\/$/, "") ||
      "http://localhost:8000";
    this.serviceKey = config.supabaseServiceRoleKey || "";
    if (!this.serviceKey) {
      logger.warn("⚠ Supabase Storage is missing SERVICE_ROLE_KEY.");
    }
  }

  async upload(
    bucket: string,
    filePath: string,
    fileData: BodyInit | Uint8Array | Blob | File,
    mimeType: string = "application/octet-stream",
  ): Promise<string> {
    const url = `${this.baseUrl}/storage/v1/object/${bucket}/${filePath}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": mimeType,
        // FIX: Thiếu header này — nếu file đã tồn tại thì Supabase trả 400.
        // x-upsert: true cho phép ghi đè giống cách PUT của S3 hoạt động mặc định.
        "x-upsert": "true",
      },
      body: fileData as BodyInit,
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error(`Supabase Storage Upload Error: ${errorData}`);
      throw new Error(
        `Failed to upload to Supabase Storage: ${response.statusText}`,
      );
    }

    logger.info(`✅ Uploaded file to Supabase Storage: ${bucket}/${filePath}`);
    return `${this.baseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
  }

  async delete(bucket: string, filePath: string): Promise<void> {
    const url = `${this.baseUrl}/storage/v1/object/${bucket}/${filePath}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.serviceKey}` },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Failed to delete from Supabase Storage: ${response.statusText}`,
      );
    }
    logger.info(`🗑 Deleted from Supabase Storage: ${bucket}/${filePath}`);
  }

  async download(bucket: string, filePath: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/storage/v1/object/${bucket}/${filePath}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.serviceKey}` },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to download from Supabase Storage: ${response.statusText}`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  // Supabase có API riêng tạo signed URL nếu bucket là private
  async getPresignedPutUrl(
    bucket: string,
    filePath: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const url =
      `${this.baseUrl}/storage/v1/object/sign/upload/${bucket}/${filePath}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to create Supabase presigned URL: ${response.statusText}`,
      );
    }
    const data = await response.json() as { signedURL: string };
    return `${this.baseUrl}${data.signedURL}`;
  }
}

/**
 * 3. S3 STORAGE: Hỗ trợ AWS S3, MinIO, DigitalOcean Spaces, v.v...
 * Dùng engine MiniS3 tự code bằng Web Crypto API 100% native.
 */
export class S3StorageProvider implements IStorageProvider {
  private getClient(bucket: string): MiniS3Client {
    if (!config.s3.endpoint || !config.s3.accessKey) {
      logger.warn("⚠ S3 Storage is missing ENDPOINT or ACCESS_KEY.");
    }
    return new MiniS3Client({
      endpoint: config.s3.endpoint?.replace(/\/$/, "") ||
        "http://localhost:9000",
      region: config.s3.region || "us-east-1",
      accessKey: config.s3.accessKey || "",
      secretKey: config.s3.secretKey || "",
      bucket,
    });
  }

  async upload(
    bucket: string,
    filePath: string,
    fileData: BodyInit | Uint8Array | Blob | File,
    mimeType: string = "application/octet-stream",
  ): Promise<string> {
    const client = this.getClient(bucket);
    // FIX: Dùng helper chung toUint8Array để xử lý toàn bộ các kiểu BodyInit hợp lệ
    const body = await toUint8Array(fileData);
    const publicUrl = await client.putObject(filePath, body, mimeType);
    logger.info(`✅ Uploaded file to S3/MinIO: ${bucket}/${filePath}`);
    return publicUrl;
  }

  async delete(bucket: string, filePath: string): Promise<void> {
    const client = this.getClient(bucket);
    await client.deleteObject(filePath);
  }

  download(bucket: string, filePath: string): Promise<Uint8Array> {
    const client = this.getClient(bucket);
    return client.getObject(filePath);
  }

  getPresignedPutUrl(
    bucket: string,
    filePath: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const client = this.getClient(bucket);
    return client.getPresignedPutUrl(filePath, expiresInSeconds);
  }
}

/**
 * STORAGE SERVICE CHÍNH: Quản lý Strategy Pattern
 */
export class StorageService {
  private providers: Record<string, IStorageProvider> = {};

  constructor() {
    logger.info(
      `📦 Initializing Storage Module with default type: [${config.storageType}]`,
    );
    this.providers["local"] = new LocalStorageProvider();
    this.providers["s3"] = new S3StorageProvider();
    this.providers["supabase"] = new SupabaseStorageProvider();
  }

  getProvider(storageType?: string): IStorageProvider {
    const type = storageType || config.storageType || "local";
    const provider = this.providers[type];
    if (!provider) {
      return this.providers["local"];
    }
    return provider;
  }

  upload(
    bucket: string,
    filePath: string,
    fileData: BodyInit | Uint8Array | Blob | File,
    mimeType?: string,
    storageType?: string,
  ): Promise<string> {
    return this.getProvider(storageType).upload(
      bucket,
      filePath,
      fileData,
      mimeType,
    );
  }

  delete(
    bucket: string,
    filePath: string,
    storageType?: string,
  ): Promise<void> {
    return this.getProvider(storageType).delete(bucket, filePath);
  }

  download(
    bucket: string,
    filePath: string,
    storageType?: string,
  ): Promise<Uint8Array> {
    return this.getProvider(storageType).download(bucket, filePath);
  }

  getPresignedPutUrl(
    bucket: string,
    filePath: string,
    expiresInSeconds?: number,
    storageType?: string,
  ): Promise<string> {
    return this.getProvider(storageType).getPresignedPutUrl(
      bucket,
      filePath,
      expiresInSeconds,
    );
  }
}

// Singleton global
export const storage = new StorageService();

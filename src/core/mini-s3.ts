import { logger } from "./logger.ts";

export interface MiniS3Config {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export class MiniS3Client {
  constructor(private config: MiniS3Config) {}

  /**
   * SHA-256 hash an toàn — dùng slice() để tránh lỗi offset khi Uint8Array là subarray
   */
  private async sha256(data: string | Uint8Array): Promise<string> {
    const raw = typeof data === "string"
      ? new TextEncoder().encode(data)
      : data;
    // Cắt chính xác phần bộ nhớ của subarray, tránh lấy thừa buffer gốc
    const safeBuffer = raw.buffer.slice(
      raw.byteOffset,
      raw.byteOffset + raw.byteLength,
    ) as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest("SHA-256", safeBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * HMAC-SHA256 — dùng slice() cẩn thận giống sha256
   */
  private async hmacSha256(
    key: string | Uint8Array,
    data: string,
  ): Promise<Uint8Array> {
    const enc = new TextEncoder();
    const rawKey = typeof key === "string" ? enc.encode(key) : key;
    const safeKey = rawKey.buffer.slice(
      rawKey.byteOffset,
      rawKey.byteOffset + rawKey.byteLength,
    ) as ArrayBuffer;
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      safeKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      enc.encode(data),
    );
    return new Uint8Array(signature);
  }

  private toHex(buffer: Uint8Array): string {
    return Array.from(buffer).map((b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  /**
   * Tính toán chữ ký AWS Signature V4.
   * KHÔNG mutate object headers gốc — tạo bản copy mới để tránh side-effect.
   */
  private async signV4(
    method: string,
    url: URL,
    headers: Record<string, string>,
    payloadHash: string,
    timestamp: Date,
  ): Promise<Record<string, string>> {
    const amzDate = timestamp.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    // Tạo bản copy mới, không mutate object gốc
    const allHeaders: Record<string, string> = {
      ...headers,
      "host": url.host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
    };

    const headerKeys = Object.keys(allHeaders).sort();
    const signedHeaders = headerKeys.join(";");
    const canonicalHeaders = headerKeys.map((k) => `${k}:${allHeaders[k]}\n`)
      .join("");

    // url.search trả về "?key=val", cần bỏ dấu "?" đầu cho canonical request
    const canonicalQueryString = url.search.startsWith("?")
      ? url.search.slice(1)
      : url.search;

    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope =
      `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      await this.sha256(canonicalRequest),
    ].join("\n");

    const kDate = await this.hmacSha256(
      `AWS4${this.config.secretKey}`,
      dateStamp,
    );
    const kRegion = await this.hmacSha256(kDate, this.config.region);
    const kService = await this.hmacSha256(kRegion, "s3");
    const kSigning = await this.hmacSha256(kService, "aws4_request");
    const signature = this.toHex(await this.hmacSha256(kSigning, stringToSign));

    allHeaders["Authorization"] =
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return allHeaders;
  }

  /**
   * Upload file lên S3/MinIO.
   * Hỗ trợ PathStyle URL (bắt buộc cho MinIO self-hosted).
   */
  public async putObject(
    key: string,
    body: Uint8Array,
    contentType: string = "application/octet-stream",
  ): Promise<string> {
    const url = new URL(`${this.config.endpoint}/${this.config.bucket}/${key}`);
    const timestamp = new Date();
    const payloadHash = await this.sha256(body);

    const headers: Record<string, string> = {
      "content-type": contentType,
      "content-length": body.length.toString(),
    };

    const signedHeaders = await this.signV4(
      "PUT",
      url,
      headers,
      payloadHash,
      timestamp,
    );

    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: signedHeaders,
      body: body as unknown as BodyInit,
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(
        `S3 Upload Error: ${res.status} ${res.statusText} - ${errorText}`,
      );
      throw new Error(`S3 PutObject failed: ${res.statusText}`);
    }

    return url.toString();
  }

  /**
   * Xoá object khỏi bucket.
   */
  public async deleteObject(key: string): Promise<void> {
    const url = new URL(`${this.config.endpoint}/${this.config.bucket}/${key}`);
    const timestamp = new Date();

    const signedHeaders = await this.signV4(
      "DELETE",
      url,
      {},
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      timestamp,
    );

    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: signedHeaders,
    });

    if (!res.ok && res.status !== 204) {
      const errorText = await res.text();
      logger.error(
        `S3 Delete Error: ${res.status} ${res.statusText} - ${errorText}`,
      );
      throw new Error(`S3 DeleteObject failed: ${res.statusText}`);
    }

    logger.info(`🗑 Deleted object from S3/MinIO: ${this.config.bucket}/${key}`);
  }

  /**
   * Tải object về dưới dạng Uint8Array (Sử dụng AWS Signature V4).
   */
  public async getObject(key: string): Promise<Uint8Array> {
    const url = new URL(`${this.config.endpoint}/${this.config.bucket}/${key}`);
    const timestamp = new Date();

    const signedHeaders = await this.signV4(
      "GET",
      url,
      {},
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      timestamp,
    );

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: signedHeaders,
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(
        `S3 GetObject Error: ${res.status} ${res.statusText} - ${errorText}`,
      );
      throw new Error(`S3 GetObject failed: ${res.statusText}`);
    }

    return new Uint8Array(await res.arrayBuffer());
  }

  /**
   * Tạo Presigned URL tạm thời để Frontend upload thẳng lên S3 không qua Backend.
   * Rất hữu ích để giảm tải cho server khi upload file lớn.
   * @param key Đường dẫn file trong bucket
   * @param expiresInSeconds Thời gian URL còn hiệu lực (mặc định 15 phút)
   */
  public async getPresignedPutUrl(
    key: string,
    expiresInSeconds: number = 900,
  ): Promise<string> {
    const url = new URL(`${this.config.endpoint}/${this.config.bucket}/${key}`);
    const timestamp = new Date();
    const amzDate = timestamp.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);
    const credentialScope =
      `${dateStamp}/${this.config.region}/s3/aws4_request`;

    url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    url.searchParams.set(
      "X-Amz-Credential",
      `${this.config.accessKey}/${credentialScope}`,
    );
    url.searchParams.set("X-Amz-Date", amzDate);
    url.searchParams.set("X-Amz-Expires", expiresInSeconds.toString());
    url.searchParams.set("X-Amz-SignedHeaders", "host");

    // BẮT BUỘC: Sắp xếp các tham số query theo thứ tự Alphabet chuẩn AWS V4
    url.searchParams.sort();

    const canonicalHeaders = `host:${url.host}\n`;
    const canonicalQueryString = url.search.slice(1);
    const canonicalRequest = [
      "PUT",
      url.pathname,
      canonicalQueryString,
      canonicalHeaders,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      await this.sha256(canonicalRequest),
    ].join("\n");

    const kDate = await this.hmacSha256(
      `AWS4${this.config.secretKey}`,
      dateStamp,
    );
    const kRegion = await this.hmacSha256(kDate, this.config.region);
    const kService = await this.hmacSha256(kRegion, "s3");
    const kSigning = await this.hmacSha256(kService, "aws4_request");
    const signature = this.toHex(await this.hmacSha256(kSigning, stringToSign));

    url.searchParams.set("X-Amz-Signature", signature);
    return url.toString();
  }
}

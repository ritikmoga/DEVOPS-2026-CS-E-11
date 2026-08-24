import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { opaqueToken } from "../utils/crypto.js";
class LocalStorage {
    root = path.resolve(process.cwd(), "uploads");
    async upload(input) {
        const key = `${input.folder}/${Date.now()}-${opaqueToken(8)}-${input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const destination = path.join(this.root, key);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, input.buffer);
        return {
            key,
            url: input.visibility === "public"
                ? `/uploads/${key.replaceAll("\\", "/")}`
                : `/api/v1/files?key=${encodeURIComponent(key)}`,
            size: input.buffer.length,
            mimeType: input.mimeType,
        };
    }
    async delete(key) {
        await unlink(path.join(this.root, key)).catch(() => undefined);
    }
    async getSignedUrl(key) {
        return `/uploads/${key.replaceAll("\\", "/")}`;
    }
    async exists(key) {
        try {
            await readFile(path.join(this.root, key));
            return true;
        }
        catch {
            return false;
        }
    }
    async read(key) {
        return readFile(path.join(this.root, key));
    }
}
class S3Storage {
    client = new S3Client({
        region: env.STORAGE_REGION,
        endpoint: env.STORAGE_ENDPOINT || undefined,
        forcePathStyle: Boolean(env.STORAGE_ENDPOINT),
        credentials: env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY
            ? { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY }
            : undefined,
    });
    async upload(input) {
        const key = `${input.folder}/${Date.now()}-${opaqueToken(8)}-${input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await this.client.send(new PutObjectCommand({
            Bucket: env.STORAGE_BUCKET,
            Key: key,
            Body: input.buffer,
            ContentType: input.mimeType,
            ...(input.visibility === "public" ? { ACL: "public-read" } : {}),
        }));
        return {
            key,
            url: await this.getSignedUrl(key, 3600),
            size: input.buffer.length,
            mimeType: input.mimeType,
        };
    }
    async delete(key) {
        await this.client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
    }
    async getSignedUrl(key, expiresIn = 3600) {
        return getSignedUrl(this.client, new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }), { expiresIn });
    }
    async exists(key) {
        try {
            await this.client.send(new HeadObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
            return true;
        }
        catch {
            return false;
        }
    }
    async read(key) {
        const result = await this.client.send(new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
        return Buffer.from(await result.Body.transformToByteArray());
    }
}
export const storage = env.STORAGE_PROVIDER === "s3" ? new S3Storage() : new LocalStorage();
//# sourceMappingURL=storage.service.js.map
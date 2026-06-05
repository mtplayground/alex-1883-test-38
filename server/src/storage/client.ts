import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { getObjectStorageConfig } from "./config.js";

export type UploadImageObjectInput = {
  body: Buffer | Uint8Array;
  contentType: string;
  extension?: string;
  key?: string;
};

export type UploadImageObjectResult = {
  bucket: string;
  contentType: string;
  key: string;
};

const imagePrefix = "images";

const sanitizeExtension = (extension: string | undefined) => {
  if (!extension) {
    return "";
  }

  const normalized = extension.trim().replace(/^\.+/, "").toLowerCase();

  if (!normalized || !/^[a-z0-9]+$/.test(normalized)) {
    return "";
  }

  return `.${normalized}`;
};

const normalizeObjectKey = (key: string) =>
  key
    .split("/")
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== ".."
    )
    .join("/");

export const createImageObjectKey = (extension?: string) => {
  const suffix = sanitizeExtension(extension);

  return path.posix.join(imagePrefix, `${randomUUID()}${suffix}`);
};

export const buildPrefixedObjectKey = (key: string) => {
  const config = getObjectStorageConfig();
  const normalizedKey = normalizeObjectKey(key);

  if (!normalizedKey) {
    throw new Error("Object storage key must not be empty");
  }

  return config.prefix
    ? path.posix.join(config.prefix, normalizedKey)
    : normalizedKey;
};

export const createObjectStorageClient = () => {
  const config = getObjectStorageConfig();

  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    region: config.region,
    requestChecksumCalculation: "WHEN_REQUIRED"
  });
};

export const uploadImageObject = async ({
  body,
  contentType,
  extension,
  key
}: UploadImageObjectInput): Promise<UploadImageObjectResult> => {
  const config = getObjectStorageConfig();
  const objectKey = buildPrefixedObjectKey(
    key ?? createImageObjectKey(extension)
  );
  const client = createObjectStorageClient();

  const commandInput: PutObjectCommandInput = {
    Body: body,
    Bucket: config.bucket,
    ContentLength: body.byteLength,
    ContentType: contentType,
    Key: objectKey
  };

  await client.send(new PutObjectCommand(commandInput));

  return {
    bucket: config.bucket,
    contentType,
    key: objectKey
  };
};

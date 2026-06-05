export type ObjectStorageConfig = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  prefix: string;
  region: string;
  secretAccessKey: string;
};

const getEnv = (name: string) => process.env[name];

const getRequiredEnv = (name: string, aliases: string[] = []) => {
  const candidates = [name, ...aliases];

  for (const candidate of candidates) {
    const value = getEnv(candidate);

    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing required object storage environment variable: ${name}`
  );
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes"].includes(value.toLowerCase());
};

const normalizePrefix = (value: string | undefined) => {
  if (!value) {
    return "";
  }

  return value.replace(/^\/+|\/+$/g, "");
};

export const getObjectStorageConfig = (): ObjectStorageConfig => ({
  accessKeyId: getRequiredEnv("OBJECT_STORAGE_ACCESS_KEY_ID", [
    "AWS_ACCESS_KEY_ID",
    "S3_ACCESS_KEY_ID",
    "TIGRIS_ACCESS_KEY_ID"
  ]),
  bucket: getRequiredEnv("OBJECT_STORAGE_BUCKET", [
    "AWS_BUCKET",
    "S3_BUCKET",
    "TIGRIS_BUCKET"
  ]),
  endpoint: getRequiredEnv("OBJECT_STORAGE_ENDPOINT", [
    "AWS_ENDPOINT_URL_S3",
    "S3_ENDPOINT",
    "TIGRIS_ENDPOINT"
  ]),
  forcePathStyle: parseBoolean(
    process.env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    true
  ),
  prefix: normalizePrefix(
    process.env.OBJECT_STORAGE_PREFIX ??
      process.env.S3_PREFIX ??
      process.env.TIGRIS_PREFIX
  ),
  region:
    getEnv("OBJECT_STORAGE_REGION") ??
    getEnv("AWS_REGION") ??
    getEnv("S3_REGION") ??
    getEnv("TIGRIS_REGION") ??
    "auto",
  secretAccessKey: getRequiredEnv("OBJECT_STORAGE_SECRET_ACCESS_KEY", [
    "AWS_SECRET_ACCESS_KEY",
    "S3_SECRET_ACCESS_KEY",
    "TIGRIS_SECRET_ACCESS_KEY"
  ])
});

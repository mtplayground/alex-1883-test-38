export type NodeEnv = "development" | "test" | "production";

export type ServerConfig = {
  host: string;
  nodeEnv: string;
  port: number;
};

export type DatabaseConfig = {
  url: string;
};

export type ObjectStorageConfig = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  prefix: string;
  region: string;
  secretAccessKey: string;
};

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type JwtConfig = {
  expiresIn: string;
  secret: string;
};

export type AppConfig = {
  database: DatabaseConfig;
  server: ServerConfig;
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

  throw new Error(`Missing required environment variable: ${name}`);
};

const parsePort = (value: string | undefined): number => {
  if (!value) {
    return 8080;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
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

export const serverConfig: ServerConfig = {
  host: getEnv("HOST") ?? "0.0.0.0",
  nodeEnv: getEnv("NODE_ENV") ?? "development",
  port: parsePort(process.env.PORT)
};

export const databaseConfig: DatabaseConfig = {
  url: getRequiredEnv("DATABASE_URL")
};

export const config: AppConfig = {
  database: databaseConfig,
  server: serverConfig
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
  forcePathStyle: parseBoolean(getEnv("OBJECT_STORAGE_FORCE_PATH_STYLE"), true),
  prefix: normalizePrefix(
    getEnv("OBJECT_STORAGE_PREFIX") ??
      getEnv("S3_PREFIX") ??
      getEnv("TIGRIS_PREFIX")
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

export const getGoogleOAuthConfig = (): GoogleOAuthConfig => ({
  clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
  clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
  redirectUri: getRequiredEnv("GOOGLE_OAUTH_REDIRECT_URI")
});

export const getJwtConfig = (): JwtConfig => ({
  expiresIn: getEnv("JWT_EXPIRES_IN") ?? "7d",
  secret: getRequiredEnv("JWT_SECRET")
});

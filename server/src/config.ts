export type NodeEnv = "development" | "test" | "production";

export type ServerConfig = {
  host: string;
  nodeEnv: string;
  port: number;
};

export type CorsConfig = {
  credentials: boolean;
  origin: boolean | string[];
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

export type AuthConfig = {
  oauthStateCookieName: string;
  sessionCookieName: string;
  sessionMaxAgeSeconds: number;
  successRedirectUrl: string;
};

export type AppConfig = {
  database: DatabaseConfig;
  server: ServerConfig;
};

type EnvRequirement = {
  aliases?: string[];
  name: string;
};

const getEnv = (name: string) => process.env[name];
const objectStorageRequirements: EnvRequirement[] = [
  {
    aliases: ["AWS_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID", "TIGRIS_ACCESS_KEY_ID"],
    name: "OBJECT_STORAGE_ACCESS_KEY_ID"
  },
  {
    aliases: ["AWS_BUCKET", "S3_BUCKET", "TIGRIS_BUCKET"],
    name: "OBJECT_STORAGE_BUCKET"
  },
  {
    aliases: ["AWS_ENDPOINT_URL_S3", "S3_ENDPOINT", "TIGRIS_ENDPOINT"],
    name: "OBJECT_STORAGE_ENDPOINT"
  },
  {
    aliases: [
      "AWS_SECRET_ACCESS_KEY",
      "S3_SECRET_ACCESS_KEY",
      "TIGRIS_SECRET_ACCESS_KEY"
    ],
    name: "OBJECT_STORAGE_SECRET_ACCESS_KEY"
  }
];
const googleOAuthRequirements: EnvRequirement[] = [
  {
    name: "GOOGLE_CLIENT_ID"
  },
  {
    name: "GOOGLE_CLIENT_SECRET"
  },
  {
    name: "GOOGLE_OAUTH_REDIRECT_URI"
  }
];

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

const parseList = (value: string | undefined) => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid positive integer value: ${value}`);
  }

  return parsed;
};

const assertUrl = (value: string, name: string) => {
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
};

const collectMissingEnv = ({ aliases = [], name }: EnvRequirement) => {
  const candidates = [name, ...aliases];
  const hasValue = candidates.some((candidate) => Boolean(getEnv(candidate)));

  return hasValue ? null : name;
};

const hasAnyEnv = ({ aliases = [], name }: EnvRequirement) =>
  [name, ...aliases].some((candidate) => Boolean(getEnv(candidate)));

const hasAllEnv = (requirements: EnvRequirement[]) =>
  requirements.every((requirement) => !collectMissingEnv(requirement));

const normalizePrefix = (value: string | undefined) => {
  if (!value) {
    return "";
  }

  return value.replace(/^\/+|\/+$/g, "");
};

const parseCorsOrigin = (): CorsConfig["origin"] => {
  const origins = parseList(getEnv("CORS_ORIGIN"));

  if (origins.length > 0) {
    return origins;
  }

  return serverConfig.nodeEnv === "production" ? false : true;
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

export const isGoogleOAuthConfigured = () => hasAllEnv(googleOAuthRequirements);

export const isObjectStorageConfigured = () =>
  hasAllEnv(objectStorageRequirements);

export const getJwtConfig = (): JwtConfig => ({
  expiresIn: getEnv("JWT_EXPIRES_IN") ?? "7d",
  secret: getRequiredEnv("JWT_SECRET")
});

export const getAuthConfig = (): AuthConfig => ({
  oauthStateCookieName: getEnv("OAUTH_STATE_COOKIE_NAME") ?? "oauth_state",
  sessionCookieName: getEnv("SESSION_COOKIE_NAME") ?? "session",
  sessionMaxAgeSeconds: parsePositiveInteger(
    getEnv("SESSION_MAX_AGE_SECONDS"),
    60 * 60 * 24 * 7
  ),
  successRedirectUrl: getEnv("AUTH_SUCCESS_REDIRECT_URL") ?? "/"
});

export const getCorsConfig = (): CorsConfig => ({
  credentials: true,
  origin: parseCorsOrigin()
});

export const validateEnvironment = () => {
  const requiredVariables: EnvRequirement[] = [
    {
      name: "DATABASE_URL"
    },
    {
      name: "JWT_SECRET"
    }
  ];
  const missingVariables = requiredVariables
    .map(collectMissingEnv)
    .filter((name): name is string => Boolean(name));

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`
    );
  }

  const optionalGroups = [
    {
      name: "object storage",
      requirements: objectStorageRequirements
    },
    {
      name: "Google OAuth",
      requirements: googleOAuthRequirements
    }
  ];

  for (const group of optionalGroups) {
    if (!group.requirements.some(hasAnyEnv)) {
      continue;
    }

    const missingGroupVariables = group.requirements
      .map(collectMissingEnv)
      .filter((name): name is string => Boolean(name));

    if (missingGroupVariables.length > 0) {
      throw new Error(
        `Incomplete ${group.name} environment variables: ${missingGroupVariables.join(", ")}`
      );
    }
  }

  parsePort(getEnv("PORT"));
  parsePositiveInteger(getEnv("SESSION_MAX_AGE_SECONDS"), 60 * 60 * 24 * 7);
  assertUrl(getRequiredEnv("DATABASE_URL"), "DATABASE_URL");

  if (isGoogleOAuthConfigured()) {
    assertUrl(getGoogleOAuthConfig().redirectUri, "GOOGLE_OAUTH_REDIRECT_URI");
  }

  if (isObjectStorageConfigured()) {
    assertUrl(getObjectStorageConfig().endpoint, "OBJECT_STORAGE_ENDPOINT");
  }

  for (const origin of parseList(getEnv("CORS_ORIGIN"))) {
    assertUrl(origin, "CORS_ORIGIN");
  }

  const successRedirectUrl = getAuthConfig().successRedirectUrl;

  if (successRedirectUrl !== "/") {
    assertUrl(successRedirectUrl, "AUTH_SUCCESS_REDIRECT_URL");
  }

  if (getJwtConfig().secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
};

import { getGoogleOAuthConfig } from "../config.js";

export type GoogleTokenSet = {
  accessToken: string;
  expiresIn?: number;
  idToken?: string;
  tokenType?: string;
};

export type GoogleUserProfile = {
  avatarUrl: string | null;
  email: string;
  googleSubjectId: string;
  name: string;
};

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const userInfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo";

const scopes = ["openid", "email", "profile"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];

  return typeof value === "string" ? value : undefined;
};

const readNumber = (record: Record<string, unknown>, key: string) => {
  const value = record[key];

  return typeof value === "number" ? value : undefined;
};

const readJsonObject = async (response: Response) => {
  const value = await response.json();

  if (!isRecord(value)) {
    throw new Error("Google OAuth response was not a JSON object");
  }

  return value;
};

export const buildGoogleAuthorizationUrl = (state: string) => {
  const googleConfig = getGoogleOAuthConfig();
  const url = new URL(authorizationEndpoint);

  url.searchParams.set("client_id", googleConfig.clientId);
  url.searchParams.set("redirect_uri", googleConfig.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");

  return url;
};

export const exchangeGoogleAuthorizationCode = async (
  code: string
): Promise<GoogleTokenSet> => {
  const googleConfig = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: googleConfig.clientId,
    client_secret: googleConfig.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: googleConfig.redirectUri
  });

  const response = await fetch(tokenEndpoint, {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  const payload = await readJsonObject(response);

  if (!response.ok) {
    const errorDescription =
      readString(payload, "error_description") ??
      readString(payload, "error") ??
      "Google token exchange failed";

    throw new Error(errorDescription);
  }

  const accessToken = readString(payload, "access_token");

  if (!accessToken) {
    throw new Error("Google token response did not include an access token");
  }

  return {
    accessToken,
    expiresIn: readNumber(payload, "expires_in"),
    idToken: readString(payload, "id_token"),
    tokenType: readString(payload, "token_type")
  };
};

export const fetchGoogleUserProfile = async (
  accessToken: string
): Promise<GoogleUserProfile> => {
  const response = await fetch(userInfoEndpoint, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await readJsonObject(response);

  if (!response.ok) {
    throw new Error("Google user profile request failed");
  }

  const googleSubjectId = readString(payload, "sub");
  const email = readString(payload, "email");
  const name = readString(payload, "name") ?? email?.split("@")[0];

  if (!googleSubjectId || !email || !name) {
    throw new Error("Google user profile was missing required fields");
  }

  return {
    avatarUrl: readString(payload, "picture") ?? null,
    email,
    googleSubjectId,
    name
  };
};

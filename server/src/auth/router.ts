import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import { Router, type CookieOptions, type ErrorRequestHandler } from "express";
import {
  getAuthConfig,
  isGoogleOAuthConfigured,
  serverConfig
} from "../config.js";
import { prisma } from "../db/client.js";
import { ApiError, asyncHandler, sendApiError } from "../http/errors.js";
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserProfile,
  type GoogleUserProfile
} from "./google.js";
import { createSessionToken } from "./session.js";

class OAuthRequestError extends ApiError {
  constructor(message: string) {
    super(message, {
      code: "oauth_request_error",
      statusCode: 400
    });
    this.name = "OAuthRequestError";
  }
}

class OAuthUnavailableError extends ApiError {
  constructor() {
    super("Google sign-in is not configured for this deployment.", {
      code: "oauth_unavailable",
      statusCode: 503
    });
    this.name = "OAuthUnavailableError";
  }
}

const createState = () => randomBytes(32).toString("base64url");

const secureCookie = () => serverConfig.nodeEnv === "production";

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookie()
});

const getCookies = (cookieHeader: string | undefined) =>
  parse(cookieHeader ?? "");

const getSingleQueryParam = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const areEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const upsertUserFromGoogleProfile = async (profile: GoogleUserProfile) =>
  prisma.user.upsert({
    create: {
      avatarUrl: profile.avatarUrl,
      email: profile.email,
      googleSubjectId: profile.googleSubjectId,
      name: profile.name
    },
    update: {
      avatarUrl: profile.avatarUrl,
      email: profile.email,
      name: profile.name
    },
    where: {
      googleSubjectId: profile.googleSubjectId
    }
  });

export const authRouter = Router();

authRouter.get("/google", (req, res, next) => {
  try {
    if (!isGoogleOAuthConfigured()) {
      throw new OAuthUnavailableError();
    }

    const authConfig = getAuthConfig();
    const state = createState();
    const authorizationUrl = buildGoogleAuthorizationUrl(state);

    res.cookie(authConfig.oauthStateCookieName, state, {
      ...baseCookieOptions(),
      maxAge: 10 * 60 * 1000,
      path: "/api/auth/google/callback"
    });
    res.redirect(authorizationUrl.toString());
  } catch (error) {
    next(error);
  }
});

authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const authConfig = getAuthConfig();
    const code = getSingleQueryParam(req.query.code);
    const returnedState = getSingleQueryParam(req.query.state);
    const providerError = getSingleQueryParam(req.query.error);
    const cookies = getCookies(req.headers.cookie);
    const storedState = cookies[authConfig.oauthStateCookieName];

    res.clearCookie(authConfig.oauthStateCookieName, {
      path: "/api/auth/google/callback"
    });

    if (providerError) {
      throw new OAuthRequestError(`Google OAuth error: ${providerError}`);
    }

    if (!code || !returnedState || !storedState) {
      throw new OAuthRequestError("Google OAuth callback was missing state");
    }

    if (!areEqual(returnedState, storedState)) {
      throw new OAuthRequestError("Google OAuth state did not match");
    }

    if (!isGoogleOAuthConfigured()) {
      throw new OAuthUnavailableError();
    }

    const tokens = await exchangeGoogleAuthorizationCode(code);
    const profile = await fetchGoogleUserProfile(tokens.accessToken);
    const user = await upsertUserFromGoogleProfile(profile);
    const sessionToken = createSessionToken(user);

    res.cookie(authConfig.sessionCookieName, sessionToken, {
      ...baseCookieOptions(),
      maxAge: authConfig.sessionMaxAgeSeconds * 1000,
      path: "/"
    });
    res.redirect(authConfig.successRedirectUrl);
  })
);

const oauthErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (
    error instanceof OAuthRequestError ||
    error instanceof OAuthUnavailableError
  ) {
    sendApiError(res, error);
    return;
  }

  next(error);
};

authRouter.use(oauthErrorHandler);

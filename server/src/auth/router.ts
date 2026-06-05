import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import {
  Router,
  type CookieOptions,
  type ErrorRequestHandler,
  type RequestHandler
} from "express";
import { getAuthConfig, serverConfig } from "../config.js";
import { prisma } from "../db/client.js";
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserProfile,
  type GoogleUserProfile
} from "./google.js";
import { createSessionToken } from "./session.js";

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<void>;

class OAuthRequestError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "OAuthRequestError";
  }
}

const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    void handler(req, res, next).catch(next);
  };

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
  if (error instanceof OAuthRequestError) {
    res.status(error.statusCode).json({
      error: {
        code: "oauth_request_error",
        message: error.message
      }
    });
    return;
  }

  next(error);
};

authRouter.use(oauthErrorHandler);

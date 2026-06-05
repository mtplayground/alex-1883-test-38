import { parse } from "cookie";
import type { RequestHandler, Response } from "express";
import { getAuthConfig } from "../config.js";
import { prisma } from "../db/client.js";
import { sendErrorResponse } from "../http/errors.js";
import { verifySessionToken } from "./session.js";

export type AuthenticatedUser = {
  avatarUrl: string | null;
  createdAt: Date;
  email: string;
  googleSubjectId: string;
  id: string;
  name: string;
  updatedAt: Date;
};

const unauthorized = (res: Response) => {
  sendErrorResponse(res, 401, "unauthorized", "Authentication required.");
};

const getBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
};

const getSessionToken = (cookieHeader: string | undefined) => {
  const authConfig = getAuthConfig();
  const cookies = parse(cookieHeader ?? "");

  return cookies[authConfig.sessionCookieName];
};

export const requireAuth: RequestHandler = (req, res, next) => {
  void (async () => {
    const token =
      getBearerToken(req.headers.authorization) ??
      getSessionToken(req.headers.cookie);

    if (!token) {
      unauthorized(res);
      return;
    }

    let payload;

    try {
      payload = verifySessionToken(token);
    } catch {
      unauthorized(res);
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub
      }
    });

    if (!user) {
      unauthorized(res);
      return;
    }

    res.locals.authenticatedUser = user;
    next();
  })().catch(next);
};

export const getAuthenticatedUser = (res: Response): AuthenticatedUser => {
  const user = res.locals.authenticatedUser;

  if (!user) {
    throw new Error("Authenticated user was not attached to response locals");
  }

  return user as AuthenticatedUser;
};

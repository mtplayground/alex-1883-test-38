import jwt, { type SignOptions } from "jsonwebtoken";
import { getJwtConfig } from "../config.js";

export type SessionUser = {
  email: string;
  googleSubjectId: string;
  id: string;
};

export type SessionTokenPayload = {
  email: string;
  googleSubjectId: string;
  sub: string;
};

export const createSessionToken = (user: SessionUser) => {
  const jwtConfig = getJwtConfig();
  const payload: SessionTokenPayload = {
    email: user.email,
    googleSubjectId: user.googleSubjectId,
    sub: user.id
  };
  const options: SignOptions = {
    expiresIn: jwtConfig.expiresIn as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, jwtConfig.secret, options);
};

const isSessionTokenPayload = (
  value: unknown
): value is SessionTokenPayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.sub === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.googleSubjectId === "string"
  );
};

export const verifySessionToken = (token: string): SessionTokenPayload => {
  const jwtConfig = getJwtConfig();
  const decoded = jwt.verify(token, jwtConfig.secret);

  if (!isSessionTokenPayload(decoded)) {
    throw new Error("Session token payload was invalid");
  }

  return decoded;
};

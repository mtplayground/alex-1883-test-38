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

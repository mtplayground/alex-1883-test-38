import { Router } from "express";
import { getAuthenticatedUser, optionalAuth } from "./middleware.js";

const serializeUser = (user: ReturnType<typeof getAuthenticatedUser>) => ({
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt.toISOString(),
  email: user.email,
  googleSubjectId: user.googleSubjectId,
  id: user.id,
  name: user.name,
  updatedAt: user.updatedAt.toISOString()
});

export const meRouter = Router();

meRouter.get("/me", optionalAuth, (_req, res) => {
  const user = res.locals.authenticatedUser ? getAuthenticatedUser(res) : null;

  res.status(200).json({
    user: user ? serializeUser(user) : null
  });
});

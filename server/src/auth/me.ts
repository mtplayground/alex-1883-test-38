import { Router } from "express";
import { getAuthenticatedUser, requireAuth } from "./middleware.js";

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

meRouter.get("/me", requireAuth, (_req, res) => {
  const user = getAuthenticatedUser(res);

  res.status(200).json({
    user: serializeUser(user)
  });
});

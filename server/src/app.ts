import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { meRouter } from "./auth/me.js";
import { authRouter } from "./auth/router.js";
import { getCorsConfig } from "./config.js";
import { feedRouter } from "./feed/router.js";
import { notFoundHandler, unhandledErrorHandler } from "./http/errors.js";
import { postsRouter } from "./posts/router.js";
import { usersRouter } from "./users/router.js";

const resolveWebDistPath = () => {
  const candidates = [
    path.resolve(process.cwd(), "web/dist"),
    path.resolve(process.cwd(), "../web/dist")
  ];

  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "index.html"))
  );
};

export const createApp = () => {
  const app = express();
  const webDistPath = resolveWebDistPath();
  const webIndexPath = webDistPath
    ? path.join(webDistPath, "index.html")
    : undefined;

  app.use(helmet());
  app.use(cors(getCorsConfig()));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/auth", authRouter);
  app.use(meRouter);
  app.use("/api/feed", feedRouter);
  app.use("/api/posts", postsRouter);
  app.use("/api/users", usersRouter);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "alex-1883-test-38"
    });
  });

  if (webDistPath && webIndexPath) {
    app.use(express.static(webDistPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path === "/me") {
        next();
        return;
      }

      res.sendFile(webIndexPath);
    });
  }

  app.use(notFoundHandler);
  app.use(unhandledErrorHandler);

  return app;
};

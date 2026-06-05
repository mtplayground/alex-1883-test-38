import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { meRouter } from "./auth/me.js";
import { authRouter } from "./auth/router.js";
import { postsRouter } from "./posts/router.js";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/auth", authRouter);
  app.use(meRouter);
  app.use("/api/posts", postsRouter);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "alex-1883-test-38"
    });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "not_found",
        message: "The requested resource was not found."
      }
    });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error("Unhandled request error", {
      name: err instanceof Error ? err.name : undefined,
      code:
        typeof err === "object" && err !== null && "code" in err
          ? err.code
          : undefined,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });

    res.status(500).json({
      error: {
        code: "internal_server_error",
        message: "An unexpected error occurred."
      }
    });
  };

  app.use(errorHandler);

  return app;
};

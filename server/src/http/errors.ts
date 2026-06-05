import type { ErrorRequestHandler, RequestHandler, Response } from "express";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

type ApiErrorOptions = {
  code?: string;
  statusCode?: number;
};

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<void>;

export class ApiError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code ?? "invalid_request";
    this.statusCode = options.statusCode ?? 400;
  }
}

export const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    void handler(req, res, next).catch(next);
  };

export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  code: string,
  message: string
) => {
  res.status(statusCode).json({
    error: {
      code,
      message
    }
  } satisfies ApiErrorBody);
};

export const sendApiError = (res: Response, error: ApiError) => {
  sendErrorResponse(res, error.statusCode, error.code, error.message);
};

export const logErrorDetails = (message: string, error: unknown) => {
  console.error(message, {
    name: error instanceof Error ? error.name : undefined,
    code:
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendErrorResponse(
    res,
    404,
    "not_found",
    "The requested resource was not found."
  );
};

export const unhandledErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  logErrorDetails("Unhandled request error", error);
  sendErrorResponse(
    res,
    500,
    "internal_server_error",
    "An unexpected error occurred."
  );
};

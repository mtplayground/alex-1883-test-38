import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import multer from "multer";
import { getAuthenticatedUser, requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/client.js";
import { uploadImageObject } from "../storage/client.js";

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<void>;

class UploadRequestError extends Error {
  statusCode = 400;

  constructor(
    message: string,
    public code = "invalid_upload"
  ) {
    super(message);
    this.name = "UploadRequestError";
  }
}

const maxImageSizeBytes = 10 * 1024 * 1024;
const maxCaptionLength = 2_200;
const imageExtensionsByMimeType = new Map([
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

const upload = multer({
  limits: {
    fileSize: maxImageSizeBytes,
    files: 1
  },
  storage: multer.memoryStorage()
});

const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    void handler(req, res, next).catch(next);
  };

const parseCaption = (value: unknown) => {
  if (typeof value === "undefined") {
    return null;
  }

  if (typeof value !== "string") {
    throw new UploadRequestError("Caption must be a string.");
  }

  const caption = value.trim();

  if (!caption) {
    return null;
  }

  if (caption.length > maxCaptionLength) {
    throw new UploadRequestError(
      `Caption must be ${maxCaptionLength} characters or fewer.`
    );
  }

  return caption;
};

const getImageExtension = (mimeType: string) =>
  imageExtensionsByMimeType.get(mimeType);

const imageUpload: RequestHandler = (req, res, next) => {
  upload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      res.status(400).json({
        error: {
          code: "invalid_upload",
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "Image must be 10 MB or smaller."
              : "Image upload was invalid."
        }
      });
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
};

const serializePost = (post: {
  caption: string | null;
  createdAt: Date;
  id: string;
  imageObjectKey: string;
  ownerUserId: string;
  updatedAt: Date;
}) => ({
  caption: post.caption,
  createdAt: post.createdAt.toISOString(),
  id: post.id,
  imageObjectKey: post.imageObjectKey,
  ownerUserId: post.ownerUserId,
  updatedAt: post.updatedAt.toISOString()
});

export const postsRouter = Router();

postsRouter.post(
  "/",
  requireAuth,
  imageUpload,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(res);
    const file = req.file;

    if (!file) {
      throw new UploadRequestError("Image file is required.");
    }

    const extension = getImageExtension(file.mimetype);

    if (!extension) {
      throw new UploadRequestError(
        "Image must be a JPEG, PNG, WEBP, or GIF file.",
        "unsupported_image_type"
      );
    }

    const body = req.body as Record<string, unknown>;
    const caption = parseCaption(body.caption);
    const uploadedImage = await uploadImageObject({
      body: file.buffer,
      contentType: file.mimetype,
      extension
    });
    const post = await prisma.post.create({
      data: {
        caption,
        imageObjectKey: uploadedImage.key,
        ownerUserId: user.id
      }
    });

    res.status(201).json({
      post: serializePost(post)
    });
  })
);

const uploadErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof UploadRequestError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  next(error);
};

postsRouter.use(uploadErrorHandler);

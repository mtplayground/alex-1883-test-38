import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import multer from "multer";
import { getAuthenticatedUser, requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/client.js";
import { uploadImageObject } from "../storage/client.js";

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<void>;

class PostRequestError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "invalid_post_request"
  ) {
    super(message);
    this.name = "PostRequestError";
  }
}

class UploadRequestError extends PostRequestError {
  constructor(message: string, code = "invalid_upload") {
    super(message, 400, code);
    this.name = "UploadRequestError";
  }
}

const maxImageSizeBytes = 10 * 1024 * 1024;
const maxCaptionLength = 2_200;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

const parsePostId = (value: unknown) => {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new PostRequestError("postId must be a valid post id.");
  }

  return value;
};

const ensurePostExists = async (postId: string) => {
  const post = await prisma.post.findUnique({
    select: {
      id: true
    },
    where: {
      id: postId
    }
  });

  if (!post) {
    throw new PostRequestError("Post was not found.", 404, "post_not_found");
  }
};

const getPostCounts = async (postId: string) => {
  const [likeCount, commentCount] = await Promise.all([
    prisma.like.count({
      where: {
        postId
      }
    }),
    prisma.comment.count({
      where: {
        postId
      }
    })
  ]);

  return {
    commentCount,
    likeCount
  };
};

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

postsRouter.post(
  "/:postId/like",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(res);
    const postId = parsePostId(req.params.postId);

    await ensurePostExists(postId);
    await prisma.like.upsert({
      create: {
        postId,
        userId: user.id
      },
      update: {},
      where: {
        userId_postId: {
          postId,
          userId: user.id
        }
      }
    });

    res.status(200).json({
      liked: true,
      postId,
      ...(await getPostCounts(postId))
    });
  })
);

postsRouter.delete(
  "/:postId/like",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(res);
    const postId = parsePostId(req.params.postId);

    await ensurePostExists(postId);
    await prisma.like.deleteMany({
      where: {
        postId,
        userId: user.id
      }
    });

    res.status(200).json({
      liked: false,
      postId,
      ...(await getPostCounts(postId))
    });
  })
);

const postErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof PostRequestError) {
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

postsRouter.use(postErrorHandler);

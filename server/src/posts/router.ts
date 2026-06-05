import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import multer from "multer";
import { getAuthenticatedUser, requireAuth } from "../auth/middleware.js";
import { isObjectStorageConfigured } from "../config.js";
import { prisma } from "../db/client.js";
import {
  ApiError,
  asyncHandler,
  sendApiError,
  sendErrorResponse
} from "../http/errors.js";
import { uploadImageObject } from "../storage/client.js";

class PostRequestError extends ApiError {
  constructor(
    message: string,
    statusCode = 400,
    code = "invalid_post_request"
  ) {
    super(message, {
      code,
      statusCode
    });
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
const maxCommentBodyLength = 1_000;
const defaultCommentLimit = 20;
const maxCommentLimit = 50;
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

const parseSingleQueryValue = (value: unknown, name: string) => {
  if (Array.isArray(value)) {
    throw new PostRequestError(`${name} must be provided once.`);
  }

  return value;
};

const parseCommentLimit = (value: unknown) => {
  const rawLimit = parseSingleQueryValue(value, "limit");

  if (typeof rawLimit === "undefined") {
    return defaultCommentLimit;
  }

  if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit)) {
    throw new PostRequestError("limit must be a positive integer.");
  }

  const limit = Number.parseInt(rawLimit, 10);

  if (limit < 1 || limit > maxCommentLimit) {
    throw new PostRequestError(
      `limit must be between 1 and ${maxCommentLimit}.`
    );
  }

  return limit;
};

const parseCommentCursor = (value: unknown) => {
  const rawCursor = parseSingleQueryValue(value, "cursor");

  if (typeof rawCursor === "undefined") {
    return null;
  }

  if (typeof rawCursor !== "string" || !uuidPattern.test(rawCursor)) {
    throw new PostRequestError("cursor must be a valid comment id.");
  }

  return rawCursor;
};

const parseCommentBody = (value: unknown) => {
  if (typeof value !== "string") {
    throw new PostRequestError("Comment body must be a string.");
  }

  const body = value.trim();

  if (!body) {
    throw new PostRequestError("Comment body is required.");
  }

  if (body.length > maxCommentBodyLength) {
    throw new PostRequestError(
      `Comment body must be ${maxCommentBodyLength} characters or fewer.`
    );
  }

  return body;
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

const ensureCommentCursorBelongsToPost = async (
  cursor: string | null,
  postId: string
) => {
  if (!cursor) {
    return;
  }

  const comment = await prisma.comment.findFirst({
    select: {
      id: true
    },
    where: {
      id: cursor,
      postId
    }
  });

  if (!comment) {
    throw new PostRequestError("cursor was not found.", 400, "invalid_cursor");
  }
};

const imageUpload: RequestHandler = (req, res, next) => {
  upload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      sendErrorResponse(
        res,
        400,
        "invalid_upload",
        error.code === "LIMIT_FILE_SIZE"
          ? "Image must be 10 MB or smaller."
          : "Image upload was invalid."
      );
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
};

const requireObjectStorage = (res: Parameters<RequestHandler>[1]) => {
  if (!isObjectStorageConfigured()) {
    sendErrorResponse(
      res,
      503,
      "object_storage_unavailable",
      "Image uploads are not configured for this deployment."
    );
    return false;
  }

  return true;
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

const serializeComment = (comment: {
  author: {
    avatarUrl: string | null;
    id: string;
    name: string;
  };
  body: string;
  createdAt: Date;
  id: string;
  postId: string;
  updatedAt: Date;
  userId: string;
}) => ({
  author: {
    avatarUrl: comment.author.avatarUrl,
    id: comment.author.id,
    name: comment.author.name
  },
  body: comment.body,
  createdAt: comment.createdAt.toISOString(),
  id: comment.id,
  postId: comment.postId,
  updatedAt: comment.updatedAt.toISOString(),
  userId: comment.userId
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

    if (!requireObjectStorage(res)) {
      return;
    }

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

postsRouter.get(
  "/:postId/comments",
  asyncHandler(async (req, res) => {
    const postId = parsePostId(req.params.postId);
    const limit = parseCommentLimit(req.query.limit);
    const cursor = parseCommentCursor(req.query.cursor);

    await ensurePostExists(postId);
    await ensureCommentCursorBelongsToPost(cursor, postId);

    const comments = await prisma.comment.findMany({
      cursor: cursor
        ? {
            id: cursor
          }
        : undefined,
      include: {
        user: {
          select: {
            avatarUrl: true,
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ],
      skip: cursor ? 1 : 0,
      take: limit + 1,
      where: {
        postId
      }
    });
    const pageComments = comments.slice(0, limit);
    const nextCursor =
      comments.length > limit ? (pageComments.at(-1)?.id ?? null) : null;

    res.status(200).json({
      comments: pageComments.map((comment) =>
        serializeComment({
          ...comment,
          author: comment.user
        })
      ),
      nextCursor
    });
  })
);

postsRouter.post(
  "/:postId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(res);
    const postId = parsePostId(req.params.postId);
    const body = req.body as Record<string, unknown>;
    const commentBody = parseCommentBody(body.body);

    await ensurePostExists(postId);

    const comment = await prisma.comment.create({
      data: {
        body: commentBody,
        postId,
        userId: user.id
      },
      include: {
        user: {
          select: {
            avatarUrl: true,
            id: true,
            name: true
          }
        }
      }
    });
    const { commentCount } = await getPostCounts(postId);

    res.status(201).json({
      comment: serializeComment({
        ...comment,
        author: comment.user
      }),
      commentCount,
      postId
    });
  })
);

const postErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof PostRequestError) {
    sendApiError(res, error);
    return;
  }

  next(error);
};

postsRouter.use(postErrorHandler);

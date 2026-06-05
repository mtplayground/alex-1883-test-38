import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import { getAuthenticatedUser, requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/client.js";

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<void>;

type InteractionCounts = {
  commentCount: number;
  likeCount: number;
};

class UserRequestError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "invalid_user_request"
  ) {
    super(message);
    this.name = "UserRequestError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const defaultProfilePostLimit = 20;
const maxProfilePostLimit = 50;

const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    void handler(req, res, next).catch(next);
  };

const parseSingleQueryValue = (value: unknown, name: string) => {
  if (Array.isArray(value)) {
    throw new UserRequestError(`${name} must be provided once.`);
  }

  return value;
};

const parseUserId = (value: unknown) => {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new UserRequestError("userId must be a valid user id.");
  }

  return value;
};

const parseProfilePostLimit = (value: unknown) => {
  const rawLimit = parseSingleQueryValue(value, "limit");

  if (typeof rawLimit === "undefined") {
    return defaultProfilePostLimit;
  }

  if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit)) {
    throw new UserRequestError("limit must be a positive integer.");
  }

  const limit = Number.parseInt(rawLimit, 10);

  if (limit < 1 || limit > maxProfilePostLimit) {
    throw new UserRequestError(
      `limit must be between 1 and ${maxProfilePostLimit}.`
    );
  }

  return limit;
};

const parseProfilePostCursor = (value: unknown) => {
  const rawCursor = parseSingleQueryValue(value, "cursor");

  if (typeof rawCursor === "undefined") {
    return null;
  }

  if (typeof rawCursor !== "string" || !uuidPattern.test(rawCursor)) {
    throw new UserRequestError("cursor must be a valid post id.");
  }

  return rawCursor;
};

const findUserProfile = async (userId: string) => {
  const profile = await prisma.user.findUnique({
    select: {
      avatarUrl: true,
      createdAt: true,
      id: true,
      name: true,
      updatedAt: true
    },
    where: {
      id: userId
    }
  });

  if (!profile) {
    throw new UserRequestError("User was not found.", 404, "user_not_found");
  }

  return profile;
};

const ensureUserExists = async (userId: string) => {
  await findUserProfile(userId);
};

const getFollowCounts = async (userId: string) => {
  const [followerCount, followingCount] = await Promise.all([
    prisma.follow.count({
      where: {
        followeeId: userId
      }
    }),
    prisma.follow.count({
      where: {
        followerId: userId
      }
    })
  ]);

  return {
    followerCount,
    followingCount
  };
};

const getProfileStats = async (userId: string) => {
  const [followCounts, postCount] = await Promise.all([
    getFollowCounts(userId),
    prisma.post.count({
      where: {
        ownerUserId: userId
      }
    })
  ]);

  return {
    ...followCounts,
    postCount
  };
};

const createZeroInteractionCounts = (postIds: string[]) =>
  new Map<string, InteractionCounts>(
    postIds.map((postId) => [
      postId,
      {
        commentCount: 0,
        likeCount: 0
      }
    ])
  );

const getPostInteractionCounts = async (postIds: string[]) => {
  const countsByPostId = createZeroInteractionCounts(postIds);

  if (postIds.length === 0) {
    return countsByPostId;
  }

  const [likeCounts, commentCounts] = await Promise.all([
    prisma.like.groupBy({
      _count: {
        _all: true
      },
      by: ["postId"],
      where: {
        postId: {
          in: postIds
        }
      }
    }),
    prisma.comment.groupBy({
      _count: {
        _all: true
      },
      by: ["postId"],
      where: {
        postId: {
          in: postIds
        }
      }
    })
  ]);

  for (const row of likeCounts) {
    const counts = countsByPostId.get(row.postId);

    if (counts) {
      counts.likeCount = row._count._all;
    }
  }

  for (const row of commentCounts) {
    const counts = countsByPostId.get(row.postId);

    if (counts) {
      counts.commentCount = row._count._all;
    }
  }

  return countsByPostId;
};

const ensureProfilePostCursorBelongsToUser = async (
  cursor: string | null,
  userId: string
) => {
  if (!cursor) {
    return;
  }

  const post = await prisma.post.findFirst({
    select: {
      id: true
    },
    where: {
      id: cursor,
      ownerUserId: userId
    }
  });

  if (!post) {
    throw new UserRequestError("cursor was not found.", 400, "invalid_cursor");
  }
};

const serializeProfile = (profile: {
  avatarUrl: string | null;
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
}) => ({
  avatarUrl: profile.avatarUrl,
  createdAt: profile.createdAt.toISOString(),
  id: profile.id,
  name: profile.name,
  updatedAt: profile.updatedAt.toISOString()
});

const serializeProfilePost = (
  post: {
    caption: string | null;
    createdAt: Date;
    id: string;
    imageObjectKey: string;
    ownerUserId: string;
    updatedAt: Date;
  },
  counts: InteractionCounts
) => ({
  caption: post.caption,
  commentCount: counts.commentCount,
  createdAt: post.createdAt.toISOString(),
  id: post.id,
  imageObjectKey: post.imageObjectKey,
  likeCount: counts.likeCount,
  ownerUserId: post.ownerUserId,
  updatedAt: post.updatedAt.toISOString()
});

export const usersRouter = Router();

usersRouter.get(
  "/:userId/profile",
  asyncHandler(async (req, res) => {
    const userId = parseUserId(req.params.userId);
    const limit = parseProfilePostLimit(req.query.limit);
    const cursor = parseProfilePostCursor(req.query.cursor);

    const profile = await findUserProfile(userId);
    await ensureProfilePostCursorBelongsToUser(cursor, userId);

    const posts = await prisma.post.findMany({
      cursor: cursor
        ? {
            id: cursor
          }
        : undefined,
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "desc"
        }
      ],
      skip: cursor ? 1 : 0,
      take: limit + 1,
      where: {
        ownerUserId: userId
      }
    });
    const pagePosts = posts.slice(0, limit);
    const postIds = pagePosts.map((post) => post.id);
    const [profileStats, countsByPostId] = await Promise.all([
      getProfileStats(userId),
      getPostInteractionCounts(postIds)
    ]);
    const nextCursor =
      posts.length > limit ? (pagePosts.at(-1)?.id ?? null) : null;

    res.status(200).json({
      nextCursor,
      posts: pagePosts.map((post) =>
        serializeProfilePost(
          post,
          countsByPostId.get(post.id) ?? {
            commentCount: 0,
            likeCount: 0
          }
        )
      ),
      profile: serializeProfile(profile),
      stats: profileStats
    });
  })
);

usersRouter.post(
  "/:userId/follow",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(res);
    const followeeId = parseUserId(req.params.userId);

    if (followeeId === user.id) {
      throw new UserRequestError(
        "Users cannot follow themselves.",
        400,
        "self_follow_not_allowed"
      );
    }

    await ensureUserExists(followeeId);
    await prisma.follow.upsert({
      create: {
        followeeId,
        followerId: user.id
      },
      update: {},
      where: {
        followerId_followeeId: {
          followeeId,
          followerId: user.id
        }
      }
    });

    res.status(200).json({
      followeeId,
      following: true,
      ...(await getFollowCounts(followeeId))
    });
  })
);

usersRouter.delete(
  "/:userId/follow",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(res);
    const followeeId = parseUserId(req.params.userId);

    if (followeeId === user.id) {
      throw new UserRequestError(
        "Users cannot unfollow themselves.",
        400,
        "self_follow_not_allowed"
      );
    }

    await ensureUserExists(followeeId);
    await prisma.follow.deleteMany({
      where: {
        followeeId,
        followerId: user.id
      }
    });

    res.status(200).json({
      followeeId,
      following: false,
      ...(await getFollowCounts(followeeId))
    });
  })
);

const userErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof UserRequestError) {
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

usersRouter.use(userErrorHandler);

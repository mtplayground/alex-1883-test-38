import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import { getAuthenticatedUser, requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/client.js";

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<void>;

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

const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    void handler(req, res, next).catch(next);
  };

const parseUserId = (value: unknown) => {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new UserRequestError("userId must be a valid user id.");
  }

  return value;
};

const ensureUserExists = async (userId: string) => {
  const user = await prisma.user.findUnique({
    select: {
      id: true
    },
    where: {
      id: userId
    }
  });

  if (!user) {
    throw new UserRequestError("User was not found.", 404, "user_not_found");
  }
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

export const usersRouter = Router();

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

import { Prisma } from "@prisma/client";
import { Router, type ErrorRequestHandler } from "express";
import { prisma } from "../db/client.js";
import { ApiError, asyncHandler, sendApiError } from "../http/errors.js";

type InteractionCounts = {
  commentCount: number;
  likeCount: number;
};

type TablePresenceRow = {
  commentsTable: string | null;
  likesTable: string | null;
};

type CountRow = {
  count: bigint | number;
  postId: string;
};

class FeedRequestError extends ApiError {
  constructor(message: string, code = "invalid_feed_request") {
    super(message, {
      code,
      statusCode: 400
    });
    this.name = "FeedRequestError";
  }
}

const defaultLimit = 20;
const maxLimit = 50;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseSingleQueryValue = (value: unknown, name: string) => {
  if (Array.isArray(value)) {
    throw new FeedRequestError(`${name} must be provided once.`);
  }

  return value;
};

const parseLimit = (value: unknown) => {
  const rawLimit = parseSingleQueryValue(value, "limit");

  if (typeof rawLimit === "undefined") {
    return defaultLimit;
  }

  if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit)) {
    throw new FeedRequestError("limit must be a positive integer.");
  }

  const limit = Number.parseInt(rawLimit, 10);

  if (limit < 1 || limit > maxLimit) {
    throw new FeedRequestError(`limit must be between 1 and ${maxLimit}.`);
  }

  return limit;
};

const parseCursor = (value: unknown) => {
  const rawCursor = parseSingleQueryValue(value, "cursor");

  if (typeof rawCursor === "undefined") {
    return null;
  }

  if (typeof rawCursor !== "string" || !rawCursor.trim()) {
    throw new FeedRequestError("cursor must be a post id.");
  }

  const cursor = rawCursor.trim();

  if (!uuidPattern.test(cursor)) {
    throw new FeedRequestError("cursor must be a valid post id.");
  }

  return cursor;
};

const createZeroCounts = (postIds: string[]) =>
  new Map<string, InteractionCounts>(
    postIds.map((postId) => [
      postId,
      {
        commentCount: 0,
        likeCount: 0
      }
    ])
  );

const toCount = (value: bigint | number) => Number(value);

const applyCountRows = (
  countsByPostId: Map<string, InteractionCounts>,
  rows: CountRow[],
  key: keyof InteractionCounts
) => {
  for (const row of rows) {
    const counts = countsByPostId.get(row.postId);

    if (counts) {
      counts[key] = toCount(row.count);
    }
  }
};

const buildPostIdList = (postIds: string[]) =>
  Prisma.join(postIds.map((postId) => Prisma.sql`${postId}::uuid`));

const getInteractionCounts = async (postIds: string[]) => {
  const countsByPostId = createZeroCounts(postIds);

  if (postIds.length === 0) {
    return countsByPostId;
  }

  const [tablePresence] = await prisma.$queryRaw<TablePresenceRow[]>`
    SELECT
      to_regclass('public.likes')::text AS "likesTable",
      to_regclass('public.comments')::text AS "commentsTable"
  `;

  if (tablePresence?.likesTable) {
    const likeRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT post_id::text AS "postId", COUNT(*)::bigint AS "count"
      FROM likes
      WHERE post_id IN (${buildPostIdList(postIds)})
      GROUP BY post_id
    `);

    applyCountRows(countsByPostId, likeRows, "likeCount");
  }

  if (tablePresence?.commentsTable) {
    const commentRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT post_id::text AS "postId", COUNT(*)::bigint AS "count"
      FROM comments
      WHERE post_id IN (${buildPostIdList(postIds)})
      GROUP BY post_id
    `);

    applyCountRows(countsByPostId, commentRows, "commentCount");
  }

  return countsByPostId;
};

const serializeFeedPost = (
  post: {
    caption: string | null;
    createdAt: Date;
    id: string;
    imageObjectKey: string;
    owner: {
      avatarUrl: string | null;
      id: string;
      name: string;
    };
    ownerUserId: string;
    updatedAt: Date;
  },
  counts: InteractionCounts
) => ({
  author: {
    avatarUrl: post.owner.avatarUrl,
    id: post.owner.id,
    name: post.owner.name
  },
  caption: post.caption,
  commentCount: counts.commentCount,
  createdAt: post.createdAt.toISOString(),
  id: post.id,
  imageObjectKey: post.imageObjectKey,
  likeCount: counts.likeCount,
  ownerUserId: post.ownerUserId,
  updatedAt: post.updatedAt.toISOString()
});

export const feedRouter = Router();

feedRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);

    if (cursor) {
      const cursorPost = await prisma.post.findUnique({
        select: {
          id: true
        },
        where: {
          id: cursor
        }
      });

      if (!cursorPost) {
        throw new FeedRequestError("cursor was not found.", "invalid_cursor");
      }
    }

    const posts = await prisma.post.findMany({
      cursor: cursor
        ? {
            id: cursor
          }
        : undefined,
      include: {
        owner: {
          select: {
            avatarUrl: true,
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "desc"
        }
      ],
      skip: cursor ? 1 : 0,
      take: limit + 1
    });
    const pagePosts = posts.slice(0, limit);
    const postIds = pagePosts.map((post) => post.id);
    const countsByPostId = await getInteractionCounts(postIds);
    const nextCursor =
      posts.length > limit ? (pagePosts.at(-1)?.id ?? null) : null;

    res.status(200).json({
      nextCursor,
      posts: pagePosts.map((post) =>
        serializeFeedPost(
          post,
          countsByPostId.get(post.id) ?? {
            commentCount: 0,
            likeCount: 0
          }
        )
      )
    });
  })
);

const feedErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof FeedRequestError) {
    sendApiError(res, error);
    return;
  }

  next(error);
};

feedRouter.use(feedErrorHandler);

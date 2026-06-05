import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { PrismaClient, User } from "@prisma/client";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { createApp as createAppType } from "./app.js";
import type { createSessionToken as createSessionTokenType } from "./auth/session.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-jwt-secret-for-backend-unit-tests";

type JsonValue = Record<string, unknown>;

type TestUserInput = {
  avatarUrl?: string | null;
  label: string;
  name?: string;
};

let appServer: Server;
let baseUrl: string;
let createSessionToken: typeof createSessionTokenType;
let prisma: PrismaClient;

const runId = `issue24-${Date.now()}-${randomUUID()}`;

const request = (path: string, init?: RequestInit) =>
  fetch(`${baseUrl}${path}`, init);

const readJson = async (response: Response) =>
  (await response.json()) as JsonValue;

const authHeaders = (user: Pick<User, "email" | "googleSubjectId" | "id">) => ({
  Authorization: `Bearer ${createSessionToken(user)}`
});

const createTestUser = ({ avatarUrl = null, label, name }: TestUserInput) => {
  const googleSubjectId = `${runId}-${label}`;

  return prisma.user.create({
    data: {
      avatarUrl,
      email: `${googleSubjectId}@example.com`,
      googleSubjectId,
      name: name ?? `Test ${label}`
    }
  });
};

const createTestPost = ({
  caption = null,
  label,
  ownerUserId
}: {
  caption?: string | null;
  label: string;
  ownerUserId: string;
}) =>
  prisma.post.create({
    data: {
      caption,
      imageObjectKey: `tests/${runId}/${label}.jpg`,
      ownerUserId
    }
  });

const cleanupTestData = async () => {
  await prisma.comment.deleteMany({
    where: {
      OR: [
        {
          user: {
            googleSubjectId: {
              startsWith: runId
            }
          }
        },
        {
          post: {
            owner: {
              googleSubjectId: {
                startsWith: runId
              }
            }
          }
        }
      ]
    }
  });
  await prisma.like.deleteMany({
    where: {
      OR: [
        {
          user: {
            googleSubjectId: {
              startsWith: runId
            }
          }
        },
        {
          post: {
            owner: {
              googleSubjectId: {
                startsWith: runId
              }
            }
          }
        }
      ]
    }
  });
  await prisma.follow.deleteMany({
    where: {
      OR: [
        {
          follower: {
            googleSubjectId: {
              startsWith: runId
            }
          }
        },
        {
          followee: {
            googleSubjectId: {
              startsWith: runId
            }
          }
        }
      ]
    }
  });
  await prisma.post.deleteMany({
    where: {
      owner: {
        googleSubjectId: {
          startsWith: runId
        }
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      googleSubjectId: {
        startsWith: runId
      }
    }
  });
};

before(async () => {
  const [{ createApp }, sessionModule, dbModule] = await Promise.all([
    import("./app.js") as Promise<{ createApp: typeof createAppType }>,
    import("./auth/session.js") as Promise<{
      createSessionToken: typeof createSessionTokenType;
    }>,
    import("./db/client.js") as Promise<{ prisma: PrismaClient }>
  ]);

  createSessionToken = sessionModule.createSessionToken;
  prisma = dbModule.prisma;
  await cleanupTestData();

  appServer = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => {
    appServer.once("listening", resolve);
  });

  const address = appServer.address() as AddressInfo;

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await cleanupTestData();
  await new Promise<void>((resolve, reject) => {
    appServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
  await prisma.$disconnect();
});

test("auth middleware rejects missing tokens and returns current user for valid tokens", async () => {
  const user = await createTestUser({
    label: "auth-user",
    name: "Auth User"
  });

  const missingTokenResponse = await request("/me");

  assert.equal(missingTokenResponse.status, 401);

  const invalidTokenResponse = await request("/me", {
    headers: {
      Authorization: "Bearer invalid-token"
    }
  });

  assert.equal(invalidTokenResponse.status, 401);

  const currentUserResponse = await request("/me", {
    headers: authHeaders(user)
  });
  const currentUserPayload = await readJson(currentUserResponse);

  assert.equal(currentUserResponse.status, 200);
  assert.equal((currentUserPayload.user as JsonValue).id, user.id);
  assert.equal((currentUserPayload.user as JsonValue).email, user.email);
});

test("post upload controller requires auth and validates missing images", async () => {
  const user = await createTestUser({
    label: "post-upload-user",
    name: "Post Upload User"
  });

  const unauthenticatedResponse = await request("/api/posts", {
    method: "POST"
  });

  assert.equal(unauthenticatedResponse.status, 401);

  const missingImageResponse = await request("/api/posts", {
    headers: authHeaders(user),
    method: "POST"
  });
  const missingImagePayload = await readJson(missingImageResponse);

  assert.equal(missingImageResponse.status, 400);
  assert.equal(
    (missingImagePayload.error as JsonValue).message,
    "Image file is required."
  );
});

test("like and unlike endpoints are idempotent and return updated post counts", async () => {
  const [owner, liker] = await Promise.all([
    createTestUser({
      label: "like-owner",
      name: "Like Owner"
    }),
    createTestUser({
      label: "like-user",
      name: "Like User"
    })
  ]);
  const post = await createTestPost({
    caption: "Like target",
    label: "like-target",
    ownerUserId: owner.id
  });

  const firstLikeResponse = await request(`/api/posts/${post.id}/like`, {
    headers: authHeaders(liker),
    method: "POST"
  });
  const firstLikePayload = await readJson(firstLikeResponse);

  assert.equal(firstLikeResponse.status, 200);
  assert.equal(firstLikePayload.liked, true);
  assert.equal(firstLikePayload.likeCount, 1);
  assert.equal(firstLikePayload.commentCount, 0);

  const secondLikeResponse = await request(`/api/posts/${post.id}/like`, {
    headers: authHeaders(liker),
    method: "POST"
  });
  const secondLikePayload = await readJson(secondLikeResponse);

  assert.equal(secondLikeResponse.status, 200);
  assert.equal(secondLikePayload.likeCount, 1);

  const unlikeResponse = await request(`/api/posts/${post.id}/like`, {
    headers: authHeaders(liker),
    method: "DELETE"
  });
  const unlikePayload = await readJson(unlikeResponse);

  assert.equal(unlikeResponse.status, 200);
  assert.equal(unlikePayload.liked, false);
  assert.equal(unlikePayload.likeCount, 0);
});

test("comment endpoints create, validate, and list comments for a post", async () => {
  const [owner, commenter] = await Promise.all([
    createTestUser({
      label: "comment-owner",
      name: "Comment Owner"
    }),
    createTestUser({
      label: "comment-user",
      name: "Comment User"
    })
  ]);
  const post = await createTestPost({
    caption: "Comment target",
    label: "comment-target",
    ownerUserId: owner.id
  });

  const blankCommentResponse = await request(`/api/posts/${post.id}/comments`, {
    body: JSON.stringify({
      body: "   "
    }),
    headers: {
      ...authHeaders(commenter),
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  assert.equal(blankCommentResponse.status, 400);

  const createCommentResponse = await request(
    `/api/posts/${post.id}/comments`,
    {
      body: JSON.stringify({
        body: "  A useful comment  "
      }),
      headers: {
        ...authHeaders(commenter),
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
  const createCommentPayload = await readJson(createCommentResponse);

  assert.equal(createCommentResponse.status, 201);
  assert.equal(createCommentPayload.commentCount, 1);
  assert.equal(
    (createCommentPayload.comment as JsonValue).body,
    "A useful comment"
  );

  const listCommentsResponse = await request(`/api/posts/${post.id}/comments`);
  const listCommentsPayload = await readJson(listCommentsResponse);
  const comments = listCommentsPayload.comments as JsonValue[];

  assert.equal(listCommentsResponse.status, 200);
  assert.equal(comments.length, 1);
  assert.equal(comments[0]?.body, "A useful comment");
  assert.equal((comments[0]?.author as JsonValue).id, commenter.id);
});

test("follow endpoints toggle relationships and profile returns stats with posts", async () => {
  const [profileUser, follower, followedUser] = await Promise.all([
    createTestUser({
      label: "profile-user",
      name: "Profile User"
    }),
    createTestUser({
      label: "profile-follower",
      name: "Profile Follower"
    }),
    createTestUser({
      label: "profile-followed",
      name: "Profile Followed"
    })
  ]);
  const post = await createTestPost({
    caption: "Profile post",
    label: "profile-post",
    ownerUserId: profileUser.id
  });

  await prisma.like.create({
    data: {
      postId: post.id,
      userId: follower.id
    }
  });
  await prisma.comment.create({
    data: {
      body: "Profile comment",
      postId: post.id,
      userId: follower.id
    }
  });
  await prisma.follow.create({
    data: {
      followeeId: followedUser.id,
      followerId: profileUser.id
    }
  });

  const selfFollowResponse = await request(`/api/users/${follower.id}/follow`, {
    headers: authHeaders(follower),
    method: "POST"
  });

  assert.equal(selfFollowResponse.status, 400);

  const followResponse = await request(`/api/users/${profileUser.id}/follow`, {
    headers: authHeaders(follower),
    method: "POST"
  });
  const followPayload = await readJson(followResponse);

  assert.equal(followResponse.status, 200);
  assert.equal(followPayload.following, true);
  assert.equal(followPayload.followerCount, 1);
  assert.equal(followPayload.followingCount, 1);

  const profileResponse = await request(`/api/users/${profileUser.id}/profile`);
  const profilePayload = await readJson(profileResponse);
  const profilePosts = profilePayload.posts as JsonValue[];

  assert.equal(profileResponse.status, 200);
  assert.equal((profilePayload.profile as JsonValue).id, profileUser.id);
  assert.equal((profilePayload.stats as JsonValue).followerCount, 1);
  assert.equal((profilePayload.stats as JsonValue).followingCount, 1);
  assert.equal((profilePayload.stats as JsonValue).postCount, 1);
  assert.equal(profilePosts.length, 1);
  assert.equal(profilePosts[0]?.likeCount, 1);
  assert.equal(profilePosts[0]?.commentCount, 1);

  const unfollowResponse = await request(
    `/api/users/${profileUser.id}/follow`,
    {
      headers: authHeaders(follower),
      method: "DELETE"
    }
  );
  const unfollowPayload = await readJson(unfollowResponse);

  assert.equal(unfollowResponse.status, 200);
  assert.equal(unfollowPayload.following, false);
  assert.equal(unfollowPayload.followerCount, 0);
  assert.equal(unfollowPayload.followingCount, 1);
});

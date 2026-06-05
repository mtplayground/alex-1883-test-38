import { buildApiUrl } from "./auth";

export type ProfileUser = {
  avatarUrl: string | null;
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
};

export type ProfileStats = {
  followerCount: number;
  followingCount: number;
  postCount: number;
};

export type ProfilePost = {
  caption: string | null;
  commentCount: number;
  createdAt: string;
  id: string;
  imageObjectKey: string;
  likeCount: number;
  ownerUserId: string;
  updatedAt: string;
};

export type UserProfilePage = {
  nextCursor: string | null;
  posts: ProfilePost[];
  profile: ProfileUser;
  stats: ProfileStats;
};

export type FollowResult = {
  followeeId: string;
  followerCount: number;
  following: boolean;
  followingCount: number;
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isProfileUser = (value: unknown): value is ProfileUser => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (typeof value.avatarUrl === "string" || value.avatarUrl === null) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const isProfileStats = (value: unknown): value is ProfileStats => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.followerCount === "number" &&
    typeof value.followingCount === "number" &&
    typeof value.postCount === "number"
  );
};

const isProfilePost = (value: unknown): value is ProfilePost => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.ownerUserId === "string" &&
    typeof value.imageObjectKey === "string" &&
    (typeof value.caption === "string" || value.caption === null) &&
    typeof value.likeCount === "number" &&
    typeof value.commentCount === "number" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const isUserProfilePage = (value: unknown): value is UserProfilePage =>
  isRecord(value) &&
  (typeof value.nextCursor === "string" || value.nextCursor === null) &&
  Array.isArray(value.posts) &&
  value.posts.every(isProfilePost) &&
  isProfileUser(value.profile) &&
  isProfileStats(value.stats);

const isFollowResult = (value: unknown): value is FollowResult => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.followeeId === "string" &&
    typeof value.following === "boolean" &&
    typeof value.followerCount === "number" &&
    typeof value.followingCount === "number"
  );
};

const readErrorMessage = async (response: Response) => {
  try {
    const payload: unknown = await response.json();

    if (isRecord(payload)) {
      const error = (payload as ApiErrorResponse).error;

      if (error?.message) {
        return error.message;
      }
    }
  } catch (_error) {
    return null;
  }

  return null;
};

export const fetchUserProfilePage = async ({
  cursor,
  limit = 12,
  signal,
  userId
}: {
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
  userId: string;
}) => {
  const searchParams = new URLSearchParams({
    limit: String(limit)
  });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  const response = await fetch(
    buildApiUrl(`/api/users/${userId}/profile?${searchParams}`),
    {
      credentials: "include",
      signal
    }
  );

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response);

    throw new Error(
      serverMessage ?? `Profile request failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isUserProfilePage(payload)) {
    throw new Error("Profile response had an unexpected shape");
  }

  return payload;
};

export const followUser = async (userId: string) => {
  const response = await fetch(buildApiUrl(`/api/users/${userId}/follow`), {
    credentials: "include",
    method: "POST"
  });

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response);

    throw new Error(
      serverMessage ?? `Follow failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isFollowResult(payload)) {
    throw new Error("Follow response had an unexpected shape");
  }

  return payload;
};

export const unfollowUser = async (userId: string) => {
  const response = await fetch(buildApiUrl(`/api/users/${userId}/follow`), {
    credentials: "include",
    method: "DELETE"
  });

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response);

    throw new Error(
      serverMessage ?? `Unfollow failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isFollowResult(payload)) {
    throw new Error("Unfollow response had an unexpected shape");
  }

  return payload;
};

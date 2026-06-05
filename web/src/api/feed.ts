import { buildApiUrl } from "./auth";

export type FeedAuthor = {
  avatarUrl: string | null;
  id: string;
  name: string;
};

export type FeedPost = {
  author: FeedAuthor;
  caption: string | null;
  commentCount: number;
  createdAt: string;
  id: string;
  imageObjectKey: string;
  likeCount: number;
  ownerUserId: string;
  updatedAt: string;
};

export type FeedPage = {
  nextCursor: string | null;
  posts: FeedPost[];
};

const objectStoragePublicBaseUrl =
  import.meta.env.VITE_OBJECT_STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, "") ??
  "";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFeedAuthor = (value: unknown): value is FeedAuthor => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (typeof value.avatarUrl === "string" || value.avatarUrl === null)
  );
};

const isFeedPost = (value: unknown): value is FeedPost => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFeedAuthor(value.author) &&
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

const isFeedPage = (value: unknown): value is FeedPage =>
  isRecord(value) &&
  (typeof value.nextCursor === "string" || value.nextCursor === null) &&
  Array.isArray(value.posts) &&
  value.posts.every(isFeedPost);

export const fetchFeedPage = async ({
  cursor,
  limit = 10,
  signal
}: {
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}) => {
  const searchParams = new URLSearchParams({
    limit: String(limit)
  });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  const response = await fetch(buildApiUrl(`/api/feed?${searchParams}`), {
    credentials: "include",
    signal
  });

  if (!response.ok) {
    throw new Error(`Feed request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();

  if (!isFeedPage(payload)) {
    throw new Error("Feed response had an unexpected shape");
  }

  return payload;
};

export const buildPostImageUrl = (imageObjectKey: string) => {
  if (/^https?:\/\//i.test(imageObjectKey)) {
    return imageObjectKey;
  }

  if (!objectStoragePublicBaseUrl) {
    return null;
  }

  const encodedKey = imageObjectKey
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `${objectStoragePublicBaseUrl}/${encodedKey}`;
};

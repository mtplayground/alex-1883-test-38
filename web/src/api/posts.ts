import { buildApiUrl } from "./auth";

export type UploadedPost = {
  caption: string | null;
  createdAt: string;
  id: string;
  imageObjectKey: string;
  ownerUserId: string;
  updatedAt: string;
};

export type PostCommentAuthor = {
  avatarUrl: string | null;
  id: string;
  name: string;
};

export type PostComment = {
  author: PostCommentAuthor;
  body: string;
  createdAt: string;
  id: string;
  postId: string;
  updatedAt: string;
  userId: string;
};

export type CommentPage = {
  comments: PostComment[];
  nextCursor: string | null;
};

export type PostInteractionCounts = {
  commentCount: number;
  likeCount: number;
  liked: boolean;
  postId: string;
};

type UploadPostResponse = {
  post: UploadedPost;
};

type CreateCommentResponse = {
  comment: PostComment;
  commentCount: number;
  postId: string;
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isUploadedPost = (value: unknown): value is UploadedPost => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.ownerUserId === "string" &&
    typeof value.imageObjectKey === "string" &&
    (typeof value.caption === "string" || value.caption === null) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const isUploadPostResponse = (value: unknown): value is UploadPostResponse =>
  isRecord(value) && isUploadedPost(value.post);

const isPostCommentAuthor = (value: unknown): value is PostCommentAuthor => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (typeof value.avatarUrl === "string" || value.avatarUrl === null)
  );
};

const isPostComment = (value: unknown): value is PostComment => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPostCommentAuthor(value.author) &&
    typeof value.id === "string" &&
    typeof value.postId === "string" &&
    typeof value.userId === "string" &&
    typeof value.body === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const isCommentPage = (value: unknown): value is CommentPage =>
  isRecord(value) &&
  Array.isArray(value.comments) &&
  value.comments.every(isPostComment) &&
  (typeof value.nextCursor === "string" || value.nextCursor === null);

const isCreateCommentResponse = (
  value: unknown
): value is CreateCommentResponse =>
  isRecord(value) &&
  isPostComment(value.comment) &&
  typeof value.commentCount === "number" &&
  typeof value.postId === "string";

const isPostInteractionCounts = (
  value: unknown
): value is PostInteractionCounts => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.postId === "string" &&
    typeof value.liked === "boolean" &&
    typeof value.likeCount === "number" &&
    typeof value.commentCount === "number"
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

export const uploadPost = async ({
  caption,
  image
}: {
  caption: string;
  image: File;
}) => {
  const formData = new FormData();

  formData.append("image", image);

  if (caption.trim()) {
    formData.append("caption", caption.trim());
  }

  const response = await fetch(buildApiUrl("/api/posts"), {
    body: formData,
    credentials: "include",
    method: "POST"
  });

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response);

    throw new Error(
      serverMessage ?? `Upload failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isUploadPostResponse(payload)) {
    throw new Error("Upload response had an unexpected shape");
  }

  return payload.post;
};

export const likePost = async (postId: string) => {
  const response = await fetch(buildApiUrl(`/api/posts/${postId}/like`), {
    credentials: "include",
    method: "POST"
  });

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response);

    throw new Error(
      serverMessage ?? `Like failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isPostInteractionCounts(payload)) {
    throw new Error("Like response had an unexpected shape");
  }

  return payload;
};

export const unlikePost = async (postId: string) => {
  const response = await fetch(buildApiUrl(`/api/posts/${postId}/like`), {
    credentials: "include",
    method: "DELETE"
  });

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response);

    throw new Error(
      serverMessage ?? `Unlike failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isPostInteractionCounts(payload)) {
    throw new Error("Unlike response had an unexpected shape");
  }

  return payload;
};

export const fetchPostComments = async ({
  cursor,
  limit = 3,
  postId
}: {
  cursor?: string | null;
  limit?: number;
  postId: string;
}) => {
  const searchParams = new URLSearchParams({
    limit: String(limit)
  });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  const response = await fetch(
    buildApiUrl(`/api/posts/${postId}/comments?${searchParams}`),
    {
      credentials: "include"
    }
  );

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response);

    throw new Error(
      serverMessage ?? `Comments request failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isCommentPage(payload)) {
    throw new Error("Comments response had an unexpected shape");
  }

  return payload;
};

export const createPostComment = async ({
  body,
  postId
}: {
  body: string;
  postId: string;
}) => {
  const response = await fetch(buildApiUrl(`/api/posts/${postId}/comments`), {
    body: JSON.stringify({
      body
    }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response);

    throw new Error(
      serverMessage ?? `Comment failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isCreateCommentResponse(payload)) {
    throw new Error("Comment response had an unexpected shape");
  }

  return payload;
};

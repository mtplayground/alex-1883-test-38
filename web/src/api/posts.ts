import { buildApiUrl } from "./auth";

export type UploadedPost = {
  caption: string | null;
  createdAt: string;
  id: string;
  imageObjectKey: string;
  ownerUserId: string;
  updatedAt: string;
};

type UploadPostResponse = {
  post: UploadedPost;
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

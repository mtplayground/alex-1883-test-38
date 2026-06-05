export type CurrentUser = {
  avatarUrl: string | null;
  createdAt: string;
  email: string;
  googleSubjectId: string;
  id: string;
  name: string;
  updatedAt: string;
};

type CurrentUserResponse = {
  user: CurrentUser;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${apiBaseUrl}${normalizedPath}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCurrentUser = (value: unknown): value is CurrentUser => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.googleSubjectId === "string" &&
    typeof value.email === "string" &&
    typeof value.name === "string" &&
    (typeof value.avatarUrl === "string" || value.avatarUrl === null) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const isCurrentUserResponse = (value: unknown): value is CurrentUserResponse =>
  isRecord(value) && isCurrentUser(value.user);

export const fetchCurrentUser = async (signal?: AbortSignal) => {
  const response = await fetch(buildApiUrl("/me"), {
    credentials: "include",
    signal
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Current user request failed with status ${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (!isCurrentUserResponse(payload)) {
    throw new Error("Current user response had an unexpected shape");
  }

  return payload.user;
};

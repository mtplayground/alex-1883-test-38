import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react";
import { useAuth } from "./auth/AuthContext";
import type { CurrentUser } from "./api/auth";
import { uploadPost, type UploadedPost } from "./api/posts";
import { fetchFeedPage, type FeedPost } from "./api/feed";
import { PostCard } from "./components/PostCard";

const maxImageSizeBytes = 10 * 1024 * 1024;
const maxCaptionLength = 2_200;
const supportedImageTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const formatBytes = (bytes: number) => {
  const megabytes = bytes / (1024 * 1024);

  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
};

const getImageValidationError = (file: File) => {
  if (!supportedImageTypes.has(file.type)) {
    return "Choose a JPEG, PNG, WEBP, or GIF image.";
  }

  if (file.size > maxImageSizeBytes) {
    return "Choose an image that is 10 MB or smaller.";
  }

  return null;
};

function getInitials(user: CurrentUser) {
  const source = user.name.trim() || user.email;
  const initials = source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
}

function UserAvatar({ user }: { user: CurrentUser }) {
  if (user.avatarUrl) {
    return (
      <img
        alt=""
        className="h-9 w-9 rounded-full border border-slate-200 bg-white object-cover"
        referrerPolicy="no-referrer"
        src={user.avatarUrl}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-sm font-bold text-ink"
    >
      {getInitials(user)}
    </div>
  );
}

function UserBadge({ user }: { user: CurrentUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <UserAvatar user={user} />
      <div className="hidden min-w-0 sm:block">
        <p className="max-w-44 truncate text-sm font-semibold text-slate-950">
          {user.name}
        </p>
      </div>
    </div>
  );
}

function SignInButton() {
  const { error, signIn, status, user } = useAuth();
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && user;

  if (isAuthenticated) {
    return <UserBadge user={user} />;
  }

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <span className="hidden max-w-64 truncate text-sm text-slate-500 sm:inline">
          Session unavailable
        </span>
      ) : null}
      <button
        className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
        disabled={isLoading}
        onClick={signIn}
        type="button"
      >
        {isLoading ? "Checking..." : "Sign in"}
      </button>
    </div>
  );
}

function UploadForm({
  isAuthenticated,
  onUploaded
}: {
  isAuthenticated: boolean;
  onUploaded: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedPost, setUploadedPost] = useState<UploadedPost | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captionCharactersRemaining = maxCaptionLength - caption.length;
  const canSubmit = isAuthenticated && imageFile && !isUploading;

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(imageFile);

    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [imageFile]);

  const imageMeta = useMemo(() => {
    if (!imageFile) {
      return null;
    }

    return `${imageFile.name} · ${formatBytes(imageFile.size)}`;
  }, [imageFile]);

  const clearSelection = () => {
    setImageFile(null);
    setUploadedPost(null);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.currentTarget.files?.[0] ?? null;

    setUploadedPost(null);

    if (!nextFile) {
      setImageFile(null);
      setError(null);
      return;
    }

    const validationError = getImageValidationError(nextFile);

    if (validationError) {
      setImageFile(null);
      setError(validationError);
      event.currentTarget.value = "";
      return;
    }

    setImageFile(nextFile);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthenticated) {
      setError("Sign in before uploading a photo.");
      return;
    }

    if (!imageFile) {
      setError("Choose an image before uploading.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadedPost(null);

    try {
      const post = await uploadPost({
        caption,
        image: imageFile
      });

      setUploadedPost(post);
      onUploaded();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The upload could not be completed."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form
      className="mt-10 max-w-xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label
            className="block text-sm font-semibold text-slate-900"
            htmlFor="post-image"
          >
            Image
          </label>
          <input
            ref={fileInputRef}
            accept="image/gif,image/jpeg,image/png,image/webp"
            className="mt-2 block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isAuthenticated || isUploading}
            id="post-image"
            name="image"
            onChange={handleImageChange}
            type="file"
          />
          {imageMeta ? (
            <p className="mt-2 text-sm text-slate-500">{imageMeta}</p>
          ) : null}
        </div>

        {previewUrl ? (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-100">
            <img
              alt=""
              className="aspect-[4/3] w-full object-cover"
              src={previewUrl}
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-500">
            Select an image to preview it here
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-4">
            <label
              className="text-sm font-semibold text-slate-900"
              htmlFor="post-caption"
            >
              Caption
            </label>
            <span className="text-xs font-medium text-slate-500">
              {captionCharactersRemaining}
            </span>
          </div>
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:cursor-not-allowed disabled:bg-slate-100"
            disabled={!isAuthenticated || isUploading}
            id="post-caption"
            maxLength={maxCaptionLength}
            name="caption"
            onChange={(event) => setCaption(event.currentTarget.value)}
            placeholder="Write a caption"
            value={caption}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {uploadedPost ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            Uploaded successfully.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="rounded-md bg-coral px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!canSubmit}
            type="submit"
          >
            {isUploading ? "Uploading..." : "Upload photo"}
          </button>
          {imageFile ? (
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUploading}
              onClick={clearSelection}
              type="button"
            >
              Clear
            </button>
          ) : null}
          {!isAuthenticated ? (
            <span className="text-sm text-slate-500">
              Sign in to enable uploads.
            </span>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function FeedSection({
  isAuthenticated,
  refreshKey
}: {
  isAuthenticated: boolean;
  refreshKey: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  const loadFirstPage = useMemo(
    () => async (signal?: AbortSignal) => {
      setError(null);
      setIsInitialLoading(true);

      try {
        const page = await fetchFeedPage({
          limit: 10,
          signal
        });

        setPosts(page.posts);
        setNextCursor(page.nextCursor);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "The feed could not be loaded."
        );
      } finally {
        if (!signal?.aborted) {
          setIsInitialLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadFirstPage(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadFirstPage, refreshKey]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setError(null);
    setIsLoadingMore(true);

    try {
      const page = await fetchFeedPage({
        cursor: nextCursor,
        limit: 10
      });

      setPosts((currentPosts) => [...currentPosts, ...page.posts]);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "More posts could not be loaded."
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <section className="w-full border-t border-slate-200 bg-white px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-coral">
              Feed
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Latest posts
            </h2>
          </div>
          <button
            className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            disabled={isInitialLoading}
            onClick={() => void loadFirstPage()}
            type="button"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {isInitialLoading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                aria-hidden="true"
                className="h-96 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
                key={index}
              />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {posts.map((post) => (
                <PostCard
                  isAuthenticated={isAuthenticated}
                  key={post.id}
                  post={post}
                />
              ))}
            </div>

            {nextCursor ? (
              <div className="mt-8 flex justify-center">
                <button
                  className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                  disabled={isLoadingMore}
                  onClick={() => void loadMore()}
                  type="button"
                >
                  {isLoadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No posts have been shared yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function App() {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <span className="text-sm font-semibold text-slate-700">
            alex-1883-test-38
          </span>
          <SignInButton />
        </div>
      </header>
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-coral">
            alex-1883-test-38
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            Share a photo with a caption.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-700">
            Select a JPEG, PNG, WEBP, or GIF image, preview it locally, and
            publish it to your account.
          </p>
        </div>
        <UploadForm
          isAuthenticated={isAuthenticated}
          onUploaded={() => setFeedRefreshKey((key) => key + 1)}
        />
      </section>
      <FeedSection
        isAuthenticated={isAuthenticated}
        refreshKey={feedRefreshKey}
      />
    </main>
  );
}

export default App;

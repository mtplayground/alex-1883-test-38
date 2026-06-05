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

function UploadForm({ isAuthenticated }: { isAuthenticated: boolean }) {
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

function App() {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";

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
        <UploadForm isAuthenticated={isAuthenticated} />
      </section>
    </main>
  );
}

export default App;

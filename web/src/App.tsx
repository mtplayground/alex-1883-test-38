import { useAuth } from "./auth/AuthContext";
import type { CurrentUser } from "./api/auth";

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

function App() {
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
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-coral">
            alex-1883-test-38
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            Frontend scaffold is ready for the social photo workflow.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-700">
            React, TypeScript, Vite, and Tailwind are configured as the base for
            authentication, uploads, feeds, interactions, and profiles in later
            issues.
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;

import { useAuth } from "./auth/AuthContext";

function SignInButton() {
  const { error, signIn, status } = useAuth();
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  if (isAuthenticated) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
        Signed in
      </div>
    );
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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { buildApiUrl, fetchCurrentUser, type CurrentUser } from "../api/auth";

type AuthStatus = "authenticated" | "loading" | "unauthenticated";

type AuthContextValue = {
  error: string | null;
  refresh: () => Promise<void>;
  signIn: () => void;
  status: AuthStatus;
  user: CurrentUser | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCurrentUser = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const currentUser = await fetchCurrentUser(signal);

      setUser(currentUser);
      setStatus(currentUser ? "authenticated" : "unauthenticated");
    } catch (loadError) {
      if (isAbortError(loadError)) {
        return;
      }

      setUser(null);
      setStatus("unauthenticated");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load session state"
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadCurrentUser(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadCurrentUser]);

  const refresh = useCallback(() => loadCurrentUser(), [loadCurrentUser]);

  const signIn = useCallback(() => {
    window.location.assign(buildApiUrl("/api/auth/google"));
  }, []);

  const value = useMemo(
    () => ({
      error,
      refresh,
      signIn,
      status,
      user
    }),
    [error, refresh, signIn, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
};

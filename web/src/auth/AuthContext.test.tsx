import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "../api/auth";
import { AuthProvider, useAuth } from "./AuthContext";

const currentUser: CurrentUser = {
  avatarUrl: null,
  createdAt: "2026-06-05T09:00:00.000Z",
  email: "ada@example.com",
  googleSubjectId: "google-ada",
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ada Lovelace",
  updatedAt: "2026-06-05T09:00:00.000Z"
};

function AuthProbe() {
  const { error, status, user } = useAuth();

  return (
    <div>
      <p>Status: {status}</p>
      <p>User: {user?.name ?? "none"}</p>
      <p>Error: {error ?? "none"}</p>
    </div>
  );
}

describe("AuthProvider", () => {
  it("loads and exposes the current user", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: currentUser }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      })
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByText("Status: loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Status: authenticated")).toBeInTheDocument();
    });
    expect(screen.getByText("User: Ada Lovelace")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/me",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("treats a 401 current-user response as unauthenticated", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 401
      })
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Status: unauthenticated")).toBeInTheDocument();
    });
    expect(screen.getByText("User: none")).toBeInTheDocument();
  });
});

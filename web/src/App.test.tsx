import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadPost } from "./api/posts";
import { fetchUserProfilePage, followUser, unfollowUser } from "./api/users";
import { useAuth } from "./auth/AuthContext";
import { ProfilePage, UploadForm } from "./App";

vi.mock("./api/posts", () => ({
  uploadPost: vi.fn()
}));

vi.mock("./api/users", () => ({
  fetchUserProfilePage: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn()
}));

vi.mock("./auth/AuthContext", () => ({
  useAuth: vi.fn()
}));

const currentUser = {
  avatarUrl: null,
  createdAt: "2026-06-05T09:00:00.000Z",
  email: "viewer@example.com",
  googleSubjectId: "viewer-google",
  id: "88888888-8888-4888-8888-888888888888",
  name: "Viewer",
  updatedAt: "2026-06-05T09:00:00.000Z"
};

const profilePage = {
  nextCursor: null,
  posts: [
    {
      caption: "Profile photo",
      commentCount: 2,
      createdAt: "2026-06-05T09:10:00.000Z",
      id: "99999999-9999-4999-8999-999999999999",
      imageObjectKey: "images/profile.jpg",
      likeCount: 3,
      ownerUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      updatedAt: "2026-06-05T09:10:00.000Z"
    }
  ],
  profile: {
    avatarUrl: null,
    createdAt: "2026-06-05T09:00:00.000Z",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Profile Owner",
    updatedAt: "2026-06-05T09:00:00.000Z"
  },
  stats: {
    followerCount: 4,
    followingCount: 5,
    postCount: 1
  }
};

describe("UploadForm", () => {
  it("validates unsupported image input", () => {
    render(<UploadForm isAuthenticated onUploaded={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Image"), {
      target: {
        files: [
          new File(["not image"], "notes.txt", {
            type: "text/plain"
          })
        ]
      }
    });

    expect(
      screen.getByText("Choose a JPEG, PNG, WEBP, or GIF image.")
    ).toBeInTheDocument();
  });

  it("uploads a selected image", async () => {
    vi.mocked(uploadPost).mockResolvedValue({
      caption: "A caption",
      createdAt: "2026-06-05T09:20:00.000Z",
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      imageObjectKey: "images/upload.jpg",
      ownerUserId: currentUser.id,
      updatedAt: "2026-06-05T09:20:00.000Z"
    });
    const onUploaded = vi.fn();
    const user = userEvent.setup();

    render(<UploadForm isAuthenticated onUploaded={onUploaded} />);

    await user.upload(
      screen.getByLabelText("Image"),
      new File(["image"], "photo.png", {
        type: "image/png"
      })
    );
    await user.type(screen.getByLabelText("Caption"), "A caption");
    await user.click(screen.getByRole("button", { name: "Upload photo" }));

    await waitFor(() => {
      expect(uploadPost).toHaveBeenCalledWith(
        expect.objectContaining({
          caption: "A caption"
        })
      );
    });
    expect(onUploaded).toHaveBeenCalledOnce();
    expect(screen.getByText("Uploaded successfully.")).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      error: null,
      refresh: vi.fn(),
      signIn: vi.fn(),
      status: "authenticated",
      user: currentUser
    });
  });

  it("renders profile stats, photos, and follows a user", async () => {
    vi.mocked(fetchUserProfilePage).mockResolvedValue(profilePage);
    vi.mocked(followUser).mockResolvedValue({
      followeeId: profilePage.profile.id,
      followerCount: 5,
      following: true,
      followingCount: 5
    });
    const user = userEvent.setup();

    render(<ProfilePage isAuthenticated userId={profilePage.profile.id} />);

    expect(await screen.findByText("Profile Owner")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Profile photo")).toBeInTheDocument();
    expect(screen.getByText("3 likes")).toBeInTheDocument();
    expect(screen.getByText("2 comments")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Unfollow" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });
    expect(followUser).toHaveBeenCalledWith(profilePage.profile.id);
  });

  it("unfollows after a successful follow", async () => {
    vi.mocked(fetchUserProfilePage).mockResolvedValue(profilePage);
    vi.mocked(followUser).mockResolvedValue({
      followeeId: profilePage.profile.id,
      followerCount: 5,
      following: true,
      followingCount: 5
    });
    vi.mocked(unfollowUser).mockResolvedValue({
      followeeId: profilePage.profile.id,
      followerCount: 4,
      following: false,
      followingCount: 5
    });
    const user = userEvent.setup();

    render(<ProfilePage isAuthenticated userId={profilePage.profile.id} />);

    await screen.findByText("Profile Owner");
    await user.click(screen.getByRole("button", { name: "Follow" }));
    await screen.findByRole("button", { name: "Unfollow" });
    await user.click(screen.getByRole("button", { name: "Unfollow" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });
    expect(unfollowUser).toHaveBeenCalledWith(profilePage.profile.id);
  });
});

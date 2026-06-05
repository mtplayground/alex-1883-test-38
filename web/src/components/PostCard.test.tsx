import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../api/feed";
import {
  createPostComment,
  fetchPostComments,
  likePost,
  unlikePost
} from "../api/posts";
import { PostCard } from "./PostCard";

vi.mock("../api/posts", () => ({
  createPostComment: vi.fn(),
  fetchPostComments: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn()
}));

const post: FeedPost = {
  author: {
    avatarUrl: null,
    id: "22222222-2222-4222-8222-222222222222",
    name: "Grace Hopper"
  },
  caption: "Compiler notes",
  commentCount: 1,
  createdAt: "2026-06-05T09:00:00.000Z",
  id: "33333333-3333-4333-8333-333333333333",
  imageObjectKey: "images/post.jpg",
  likeCount: 1,
  ownerUserId: "22222222-2222-4222-8222-222222222222",
  updatedAt: "2026-06-05T09:00:00.000Z"
};

describe("PostCard", () => {
  it("renders post metadata and links to the author profile", () => {
    render(<PostCard isAuthenticated={false} post={post} />);

    expect(screen.getByRole("link", { name: /grace hopper/i })).toHaveAttribute(
      "href",
      `#/users/${post.author.id}`
    );
    expect(screen.getByText("1 like")).toBeInTheDocument();
    expect(screen.getByText("1 comment")).toBeInTheDocument();
    expect(screen.getByText("Compiler notes")).toBeInTheDocument();
    expect(screen.getByText("Image preview unavailable")).toBeInTheDocument();
  });

  it("updates like counts through the like and unlike actions", async () => {
    vi.mocked(likePost).mockResolvedValue({
      commentCount: 1,
      liked: true,
      likeCount: 2,
      postId: post.id
    });
    vi.mocked(unlikePost).mockResolvedValue({
      commentCount: 1,
      liked: false,
      likeCount: 1,
      postId: post.id
    });
    const user = userEvent.setup();

    render(<PostCard isAuthenticated post={post} />);

    await user.click(screen.getByRole("button", { name: "Like" }));

    await waitFor(() => {
      expect(screen.getByText("2 likes")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Liked" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Liked" }));

    await waitFor(() => {
      expect(screen.getByText("1 like")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Like" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("loads and submits comments", async () => {
    vi.mocked(fetchPostComments).mockResolvedValue({
      comments: [
        {
          author: {
            avatarUrl: null,
            id: "44444444-4444-4444-8444-444444444444",
            name: "Katherine Johnson"
          },
          body: "First comment",
          createdAt: "2026-06-05T09:01:00.000Z",
          id: "55555555-5555-4555-8555-555555555555",
          postId: post.id,
          updatedAt: "2026-06-05T09:01:00.000Z",
          userId: "44444444-4444-4444-8444-444444444444"
        }
      ],
      nextCursor: null
    });
    vi.mocked(createPostComment).mockResolvedValue({
      comment: {
        author: {
          avatarUrl: null,
          id: "66666666-6666-4666-8666-666666666666",
          name: "Dorothy Vaughan"
        },
        body: "Second comment",
        createdAt: "2026-06-05T09:02:00.000Z",
        id: "77777777-7777-4777-8777-777777777777",
        postId: post.id,
        updatedAt: "2026-06-05T09:02:00.000Z",
        userId: "66666666-6666-4666-8666-666666666666"
      },
      commentCount: 2,
      postId: post.id
    });
    const user = userEvent.setup();

    render(<PostCard isAuthenticated post={post} />);

    await user.click(screen.getByRole("button", { name: "Comments" }));
    expect(await screen.findByText("First comment")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Add a comment"), "Second comment");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    expect(await screen.findByText("Second comment")).toBeInTheDocument();
    expect(screen.getByText("2 comments")).toBeInTheDocument();
  });
});

import { useEffect, useState, type FormEvent } from "react";
import { buildPostImageUrl, type FeedAuthor, type FeedPost } from "../api/feed";
import {
  createPostComment,
  fetchPostComments,
  likePost,
  unlikePost,
  type PostComment
} from "../api/posts";

const pluralize = (count: number, singular: string, plural: string) =>
  `${count.toLocaleString()} ${count === 1 ? singular : plural}`;

const getAuthorInitials = (author: FeedAuthor) => {
  const initials = author.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
};

const formatPostedAt = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

function AuthorAvatar({ author }: { author: FeedAuthor }) {
  if (author.avatarUrl) {
    return (
      <img
        alt=""
        className="h-10 w-10 rounded-full border border-slate-200 bg-white object-cover"
        referrerPolicy="no-referrer"
        src={author.avatarUrl}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-sm font-bold text-ink"
    >
      {getAuthorInitials(author)}
    </div>
  );
}

export function PostCard({
  isAuthenticated,
  post
}: {
  isAuthenticated: boolean;
  post: FeedPost;
}) {
  const imageUrl = buildPostImageUrl(post.imageObjectKey);
  const [commentBody, setCommentBody] = useState("");
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [nextCommentsCursor, setNextCommentsCursor] = useState<string | null>(
    null
  );

  useEffect(() => {
    setCommentBody("");
    setCommentCount(post.commentCount);
    setComments([]);
    setCommentsError(null);
    setCommentsLoaded(false);
    setIsCommentsOpen(false);
    setIsLiked(false);
    setLikeCount(post.likeCount);
    setNextCommentsCursor(null);
  }, [post.commentCount, post.id, post.likeCount]);

  const loadComments = async ({
    append = false
  }: { append?: boolean } = {}) => {
    if (isLoadingComments) {
      return;
    }

    setCommentsError(null);
    setIsCommentsOpen(true);
    setIsLoadingComments(true);

    try {
      const page = await fetchPostComments({
        cursor: append ? nextCommentsCursor : null,
        postId: post.id
      });

      setComments((currentComments) =>
        append ? [...currentComments, ...page.comments] : page.comments
      );
      setCommentsLoaded(true);
      setNextCommentsCursor(page.nextCursor);
    } catch (loadError) {
      setCommentsError(
        loadError instanceof Error
          ? loadError.message
          : "Comments could not be loaded."
      );
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleLikeToggle = async () => {
    if (isLiking) {
      return;
    }

    if (!isAuthenticated) {
      setCommentsError("Sign in to like posts.");
      return;
    }

    setCommentsError(null);
    setIsLiking(true);

    try {
      const result = isLiked
        ? await unlikePost(post.id)
        : await likePost(post.id);

      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
      setCommentCount(result.commentCount);
    } catch (likeError) {
      setCommentsError(
        likeError instanceof Error
          ? likeError.message
          : "Like could not be updated."
      );
    } finally {
      setIsLiking(false);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPostingComment) {
      return;
    }

    if (!isAuthenticated) {
      setCommentsError("Sign in to comment.");
      return;
    }

    setCommentsError(null);
    setIsPostingComment(true);

    try {
      const result = await createPostComment({
        body: commentBody,
        postId: post.id
      });

      setCommentBody("");
      setCommentCount(result.commentCount);
      setComments((currentComments) => [...currentComments, result.comment]);
      setCommentsLoaded(true);
      setIsCommentsOpen(true);
    } catch (commentError) {
      setCommentsError(
        commentError instanceof Error
          ? commentError.message
          : "Comment could not be posted."
      );
    } finally {
      setIsPostingComment(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 px-4 py-3">
        <AuthorAvatar author={post.author} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {post.author.name}
          </p>
          <p className="text-xs font-medium text-slate-500">
            {formatPostedAt(post.createdAt)}
          </p>
        </div>
      </header>

      {imageUrl ? (
        <img
          alt={post.caption ?? `Photo by ${post.author.name}`}
          className="aspect-square w-full bg-slate-100 object-cover"
          loading="lazy"
          src={imageUrl}
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-slate-100 px-6 text-center text-sm font-medium text-slate-500">
          Image preview unavailable
        </div>
      )}

      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-4 text-sm font-semibold text-slate-700">
          <span>{pluralize(likeCount, "like", "likes")}</span>
          <span>{pluralize(commentCount, "comment", "comments")}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            aria-pressed={isLiked}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
              isLiked
                ? "bg-coral text-white hover:bg-red-500"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
            disabled={isLiking || !isAuthenticated}
            onClick={() => void handleLikeToggle()}
            type="button"
          >
            {isLiked ? "Liked" : "Like"}
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            disabled={isLoadingComments}
            onClick={() =>
              isCommentsOpen
                ? setIsCommentsOpen(false)
                : commentsLoaded
                  ? setIsCommentsOpen(true)
                  : void loadComments()
            }
            type="button"
          >
            {isCommentsOpen ? "Hide comments" : "Comments"}
          </button>
        </div>

        {post.caption ? (
          <p className="text-sm leading-6 text-slate-800">
            <span className="font-semibold text-slate-950">
              {post.author.name}
            </span>{" "}
            {post.caption}
          </p>
        ) : null}

        {commentsError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {commentsError}
          </p>
        ) : null}

        {isCommentsOpen ? (
          <div className="space-y-3 border-t border-slate-200 pt-3">
            {isLoadingComments && !commentsLoaded ? (
              <p className="text-sm font-medium text-slate-500">
                Loading comments...
              </p>
            ) : comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div
                    className="text-sm leading-6 text-slate-800"
                    key={comment.id}
                  >
                    <span className="font-semibold text-slate-950">
                      {comment.author.name}
                    </span>{" "}
                    {comment.body}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-500">
                No comments yet.
              </p>
            )}

            {nextCommentsCursor ? (
              <button
                className="text-sm font-semibold text-coral transition hover:text-red-500 disabled:cursor-wait disabled:text-slate-400"
                disabled={isLoadingComments}
                onClick={() => void loadComments({ append: true })}
                type="button"
              >
                {isLoadingComments ? "Loading..." : "Load more comments"}
              </button>
            ) : null}

            <form
              className="flex flex-col gap-2"
              onSubmit={handleCommentSubmit}
            >
              <label className="sr-only" htmlFor={`comment-${post.id}`}>
                Add a comment
              </label>
              <textarea
                className="min-h-20 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={!isAuthenticated || isPostingComment}
                id={`comment-${post.id}`}
                maxLength={1000}
                onChange={(event) => setCommentBody(event.currentTarget.value)}
                placeholder="Add a comment"
                value={commentBody}
              />
              <button
                className="w-fit rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={
                  !isAuthenticated || !commentBody.trim() || isPostingComment
                }
                type="submit"
              >
                {isPostingComment ? "Posting..." : "Post comment"}
              </button>
              {!isAuthenticated ? (
                <p className="text-sm font-medium text-slate-500">
                  Sign in to add a comment.
                </p>
              ) : null}
            </form>
          </div>
        ) : null}
      </div>
    </article>
  );
}

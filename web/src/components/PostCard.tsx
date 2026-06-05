import { buildPostImageUrl, type FeedAuthor, type FeedPost } from "../api/feed";

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

export function PostCard({ post }: { post: FeedPost }) {
  const imageUrl = buildPostImageUrl(post.imageObjectKey);

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
          <span>{pluralize(post.likeCount, "like", "likes")}</span>
          <span>{pluralize(post.commentCount, "comment", "comments")}</span>
        </div>

        {post.caption ? (
          <p className="text-sm leading-6 text-slate-800">
            <span className="font-semibold text-slate-950">
              {post.author.name}
            </span>{" "}
            {post.caption}
          </p>
        ) : null}
      </div>
    </article>
  );
}

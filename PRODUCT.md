# alex-1883-test-38

## What It Is

`alex-1883-test-38` is a full-stack photo sharing app. Users sign in with
Google, upload images with captions, browse a feed, like posts, comment on
posts, and view user profiles with follow stats.

## Current Capabilities

- Google OAuth sign-in with a server-issued JWT session cookie when real Google
  credentials are configured; otherwise sign-in returns a clear unavailable
  response instead of using placeholder credentials.
- Current-user endpoint at `GET /me`; anonymous browsers receive
  `{ "user": null }`, while invalid tokens still receive an auth error.
- Image upload flow: the frontend previews a selected image, the backend stores
  it in S3-compatible object storage, and a `posts` record is created when real
  object-storage credentials are configured. Uploads are disabled with a clear
  unavailable response when storage is not configured.
- Paginated feed API and UI showing posts with author, caption, image, like
  count, and comment count.
- Like and unlike endpoints plus a frontend like button.
- Comment create/list endpoints plus comment UI inside post cards.
- User profiles showing profile metadata, posts, follower/following counts, and
  follow/unfollow controls.
- Health endpoint at `GET /api/health`.

## Architecture

- Monorepo with npm workspaces:
  - `web/`: React 18, TypeScript, Vite, and Tailwind.
  - `server/`: Node.js, Express, TypeScript, Prisma.
- PostgreSQL is the only persistent data store. Prisma models cover users,
  posts, likes, comments, and follows.
- Google OAuth and object storage are optional deployment integrations. If any
  variable in one of those groups is provided, startup validates the whole group;
  if the group is absent, the related feature is no-op/unavailable rather than
  using fabricated credentials.
- Object storage is S3-compatible and configured through `OBJECT_STORAGE_*`
  environment variables. Object keys are normalized and prefixed through the
  storage client, and uploads send concrete content lengths.
- The frontend reads `VITE_API_BASE_URL` and
  `VITE_OBJECT_STORAGE_PUBLIC_BASE_URL` at build/runtime as Vite env values.
- The Express server serves the built Vite frontend from `web/dist` when present
  and keeps API routes under explicit prefixes before the SPA fallback.
- API errors use a consistent JSON envelope:
  `{ "error": { "code": "...", "message": "..." } }`.
- Server startup validates required env vars, URL-shaped settings, and JWT
  secret length before listening.
- Production deployments keep the PostgreSQL pool warm to avoid pooled-proxy idle
  disconnect noise in logs.

## Conventions

- Default local app port is `8080`; servers bind to `0.0.0.0` for hosted
  environments.
- Required runtime configuration is documented in `.env.example`.
- PostgreSQL migrations live under `server/prisma/migrations`.
- Self-host deployment flow is documented in `README.md`: set env, run Prisma
  migrations, build the web and server workspaces, start the API, and serve
  `web/dist` from static hosting or a CDN.
- Validation commands:
  - `npm run lint`
  - `npm run format:check`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test`
  - `npm run test:e2e`

## Test Coverage

- Backend unit tests cover auth, posts, likes, comments, follows, error
  envelopes, and env validation.
- Frontend component tests cover auth context, upload form, post cards, and
  profile UI.
- Playwright E2E covers the core sign-in, upload, feed refresh, and like flow.

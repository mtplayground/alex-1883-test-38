# alex-1883-test-38

## What It Is

`alex-1883-test-38` is a full-stack photo sharing app. Users sign in with
Google, upload images with captions, browse a feed, like posts, comment on
posts, and view user profiles with follow stats.

## Current Capabilities

- Google OAuth sign-in with a server-issued JWT session cookie.
- Authenticated current-user endpoint at `GET /me`.
- Image upload flow: the frontend previews a selected image, the backend stores
  it in S3-compatible object storage, and a `posts` record is created.
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
- Object storage is S3-compatible and configured through `OBJECT_STORAGE_*`
  environment variables. Object keys are normalized and prefixed through the
  storage client.
- The frontend reads `VITE_API_BASE_URL` and
  `VITE_OBJECT_STORAGE_PUBLIC_BASE_URL` at build/runtime as Vite env values.
- API errors use a consistent JSON envelope:
  `{ "error": { "code": "...", "message": "..." } }`.
- Server startup validates required env vars, URL-shaped settings, and JWT
  secret length before listening.

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

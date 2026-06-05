# alex-1883-test-38

## Project Structure

- `web/`: React, TypeScript, Vite, and Tailwind frontend.
- `server/`: Node, TypeScript, and Express API server.

## Scripts

Install dependencies:

```bash
npm install
```

Create a local environment file from the example and fill in real secret
values:

```bash
cp .env.example .env
```

Run the frontend on `0.0.0.0:8080`:

```bash
npm run dev:web
```

Run the API server on `0.0.0.0:8080`:

```bash
npm run dev:server
```

Build all workspaces:

```bash
npm run build
```

Run all validation checks:

```bash
export DATABASE_URL=postgresql://user:password@host:5432/alex_1883_test_38
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run test:e2e
```

Generate the Prisma client:

```bash
npm run prisma:generate --workspace server
```

Deploy database migrations with `DATABASE_URL` from the environment:

```bash
export DATABASE_URL=$(cat /workspace/.database_url)
npm run prisma:migrate:deploy --workspace server
```

Object storage uploads use S3-compatible settings from the environment:

```bash
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_PREFIX=
```

Google OAuth and JWT settings are also defined in `.env.example` for the
authentication issues that build on this scaffold.

## Self-Host Checklist

1. Provision PostgreSQL and S3-compatible object storage. PostgreSQL is required
   for all persistent state; do not use SQLite, JSON files, or ephemeral local
   storage for application data.
2. Copy `.env.example` to the host environment and set every required value:
   `DATABASE_URL`, `OBJECT_STORAGE_*`, `GOOGLE_*`, `JWT_SECRET`, `HOST`,
   `PORT`, and `CORS_ORIGIN`. Use a `JWT_SECRET` with at least 32 characters.
3. Configure Google OAuth with
   `GOOGLE_OAUTH_REDIRECT_URI=https://<api-host>/api/auth/google/callback` and
   set `AUTH_SUCCESS_REDIRECT_URL` to the frontend origin that should receive the
   user after sign-in.
4. Build the frontend with production API and object URLs available at build
   time:

   ```bash
   export VITE_API_BASE_URL=https://<api-host>
   export VITE_OBJECT_STORAGE_PUBLIC_BASE_URL=https://<public-object-host>/<prefix>
   npm run build --workspace web
   ```

5. Install dependencies and deploy database migrations before starting the API:

   ```bash
   npm ci
   npm run prisma:migrate:deploy --workspace server
   npm run build --workspace server
   ```

6. Start the API process. Startup validates required environment variables,
   checks URL-shaped values, verifies the JWT secret length, and connects to
   PostgreSQL before listening.

   ```bash
   npm run start --workspace server
   ```

7. Serve `web/dist` from a static host or CDN. The API and frontend may be on
   separate origins as long as `VITE_API_BASE_URL`, Google OAuth redirect
   settings, `CORS_ORIGIN`, and cookie settings point at the deployed API
   origin.
8. Verify the deployment:

   ```bash
   curl https://<api-host>/api/health
   npm run prisma:migrate:status --workspace server
   ```

API errors use a consistent JSON envelope:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable message."
  }
}
```

The backend exposes Google OAuth routes at:

```bash
GET /api/auth/google
GET /api/auth/google/callback
GET /me
GET /api/feed
POST /api/posts
POST /api/posts/:postId/like
DELETE /api/posts/:postId/like
GET /api/posts/:postId/comments
POST /api/posts/:postId/comments
```

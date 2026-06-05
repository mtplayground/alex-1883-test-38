# alex-1883-test-38

## Project Structure

- `web/`: React, TypeScript, Vite, and Tailwind frontend.
- `server/`: Node, TypeScript, and Express API server.

## Scripts

Install dependencies:

```bash
npm install
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

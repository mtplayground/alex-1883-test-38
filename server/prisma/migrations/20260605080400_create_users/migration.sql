CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "google_subject_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_google_subject_id_key" ON "users"("google_subject_id");

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

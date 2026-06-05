CREATE TABLE "likes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "likes_user_id_post_id_key" ON "likes"("user_id", "post_id");

CREATE INDEX "likes_post_id_idx" ON "likes"("post_id");

CREATE INDEX "likes_user_id_idx" ON "likes"("user_id");

CREATE INDEX "comments_post_id_idx" ON "comments"("post_id");

CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");

CREATE INDEX "comments_created_at_idx" ON "comments"("created_at");

ALTER TABLE "likes"
    ADD CONSTRAINT "likes_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "likes"
    ADD CONSTRAINT "likes_post_id_fkey"
    FOREIGN KEY ("post_id")
    REFERENCES "posts"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "comments"
    ADD CONSTRAINT "comments_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "comments"
    ADD CONSTRAINT "comments_post_id_fkey"
    FOREIGN KEY ("post_id")
    REFERENCES "posts"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

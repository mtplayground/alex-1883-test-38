CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "image_object_key" TEXT NOT NULL,
    "caption" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "posts_image_object_key_key" ON "posts"("image_object_key");

CREATE INDEX "posts_owner_user_id_idx" ON "posts"("owner_user_id");

CREATE INDEX "posts_created_at_idx" ON "posts"("created_at");

ALTER TABLE "posts"
    ADD CONSTRAINT "posts_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

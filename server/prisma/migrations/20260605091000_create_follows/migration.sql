CREATE TABLE "follows" (
    "id" UUID NOT NULL,
    "follower_id" UUID NOT NULL,
    "followee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "follows_no_self_follow_check" CHECK ("follower_id" <> "followee_id")
);

CREATE UNIQUE INDEX "follows_follower_id_followee_id_key" ON "follows"("follower_id", "followee_id");

CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

CREATE INDEX "follows_followee_id_idx" ON "follows"("followee_id");

ALTER TABLE "follows"
    ADD CONSTRAINT "follows_follower_id_fkey"
    FOREIGN KEY ("follower_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "follows"
    ADD CONSTRAINT "follows_followee_id_fkey"
    FOREIGN KEY ("followee_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-06-05T09:00:00.000Z";
const user = {
  avatarUrl: null,
  createdAt: now,
  email: "e2e.user@example.com",
  googleSubjectId: "google-e2e-user",
  id: "11111111-1111-4111-8111-111111111111",
  name: "E2E User",
  updatedAt: now
};
const post = {
  author: {
    avatarUrl: null,
    id: user.id,
    name: user.name
  },
  caption: "A core flow caption",
  commentCount: 0,
  createdAt: now,
  id: "22222222-2222-4222-8222-222222222222",
  imageObjectKey: "images/e2e-upload.png",
  likeCount: 0,
  ownerUserId: user.id,
  updatedAt: now
};
const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

const fulfillJson = async (route: Route, status: number, body: unknown) => {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
};

const installCoreFlowApi = async (page: Page) => {
  let isSignedIn = false;
  let isUploaded = false;
  let likeCount = 0;
  let liked = false;

  await page.route("**/me", async (route) => {
    if (!isSignedIn) {
      await fulfillJson(route, 401, {
        error: {
          code: "unauthorized",
          message: "Authentication is required."
        }
      });
      return;
    }

    await fulfillJson(route, 200, {
      user
    });
  });

  await page.route("**/api/auth/google", async (route) => {
    isSignedIn = true;
    await route.fulfill({
      headers: {
        location: "/"
      },
      status: 302
    });
  });

  await page.route("**/api/feed?**", async (route) => {
    await fulfillJson(route, 200, {
      nextCursor: null,
      posts: isUploaded
        ? [
            {
              ...post,
              likeCount
            }
          ]
        : []
    });
  });

  await page.route("**/api/posts", async (route) => {
    const request = route.request();

    expect(request.method()).toBe("POST");
    expect(request.headers()["content-type"]).toContain("multipart/form-data");

    isUploaded = true;
    await fulfillJson(route, 201, {
      post
    });
  });

  await page.route(`**/api/posts/${post.id}/like`, async (route) => {
    expect(route.request().method()).toBe("POST");

    liked = true;
    likeCount = 1;

    await fulfillJson(route, 200, {
      commentCount: post.commentCount,
      liked,
      likeCount,
      postId: post.id
    });
  });

  await page.route("**/__objects/images/e2e-upload.png", async (route) => {
    await route.fulfill({
      body: transparentPng,
      contentType: "image/png",
      status: 200
    });
  });
};

test("core flow signs in, uploads a post, refreshes the feed, and likes it", async ({
  page
}) => {
  await installCoreFlowApi(page);

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Sign in to enable uploads.")).toBeVisible();

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: user.name })).toBeVisible();
  await expect(page.getByText("No posts have been shared yet.")).toBeVisible();

  await page.getByLabel("Image").setInputFiles({
    buffer: transparentPng,
    mimeType: "image/png",
    name: "core-flow.png"
  });
  await page.getByLabel("Caption").fill(post.caption);
  await page.getByRole("button", { name: "Upload photo" }).click();

  await expect(page.getByText("Uploaded successfully.")).toBeVisible();

  const uploadedPost = page.getByRole("article").filter({
    hasText: post.caption
  });

  await expect(uploadedPost).toBeVisible();
  await expect(uploadedPost.getByRole("img")).toHaveAttribute(
    "src",
    /\/__objects\/images\/e2e-upload\.png$/
  );
  await expect(uploadedPost.getByText("0 likes")).toBeVisible();
  await expect(
    uploadedPost.getByRole("button", { name: "Like" })
  ).toBeEnabled();

  await uploadedPost.getByRole("button", { name: "Like" }).click();

  await expect(
    uploadedPost.getByRole("button", { name: "Liked" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(uploadedPost.getByText("1 like")).toBeVisible();
});

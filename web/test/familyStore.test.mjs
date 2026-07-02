import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { FamilyStore } from "../server/familyStore.mjs";

async function withStore(run) {
  const dir = await mkdtemp(path.join(tmpdir(), "miemie-store-"));
  try {
    let tick = 0;
    const store = new FamilyStore({
      dataDir: dir,
      now: () => new Date(Date.parse("2026-07-01T08:00:00.000Z") + tick++ * 1000)
    });
    await store.ready;
    await run(store);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("creates a trimmed todo with incomplete status and change event", async () => {
  await withStore(async (store) => {
    const result = await store.createPost({
      kind: "todo",
      title: "  买牛奶  ",
      body: "  顺路拿快递  ",
      authorName: "妈妈"
    });

    assert.equal(result.post.title, "买牛奶");
    assert.equal(result.post.body, "顺路拿快递");
    assert.equal(result.post.todoStatus, "incomplete");
    assert.equal(result.post.activityType, "post-added");
    assert.equal(result.post.activityAt, result.post.createdAt);
    assert.equal(result.event.type, "post-added");
    assert.equal(result.event.postId, result.post.id);
  });
});

test("rejects blank titles", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.createPost({ kind: "message", title: "  ", body: "早点回家", authorName: "爸爸" }),
      /title is required/
    );
  });
});

test("filters resources and photos together", async () => {
  await withStore(async (store) => {
    await store.createPost({ kind: "todo", title: "买牛奶", body: "", authorName: "妈妈" });
    await store.createPost({ kind: "resource", title: "疫苗本", body: "", authorName: "爸爸" });
    await store.createPost({ kind: "photo", title: "手工作品", body: "", authorName: "妈妈" });
    await store.createPost({ kind: "message", title: "早点回家", body: "", authorName: "爸爸" });

    const resources = await store.listPosts({ filter: "resource" });

    assert.deepEqual(resources.map((post) => post.title), ["手工作品", "疫苗本"]);
  });
});

test("filters all posts by requested day range while kind filters keep history", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "miemie-store-"));
  try {
    let currentTime = new Date("2026-07-01T15:30:00.000Z");
    const store = new FamilyStore({ dataDir: dir, now: () => currentTime });
    await store.ready;

    await store.createPost({ kind: "message", title: "昨天的留言", body: "", authorName: "妈妈" });
    currentTime = new Date("2026-07-02T02:00:00.000Z");
    await store.createPost({ kind: "todo", title: "今天的待办", body: "", authorName: "爸爸" });

    const today = await store.listPosts({
      filter: "all",
      from: "2026-07-02T00:00:00.000Z",
      to: "2026-07-03T00:00:00.000Z"
    });
    const messages = await store.listPosts({ filter: "message" });

    assert.deepEqual(today.map((post) => post.title), ["今天的待办"]);
    assert.deepEqual(messages.map((post) => post.title), ["昨天的留言"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pins posts before unpinned posts only in kind feeds", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "miemie-store-"));
  try {
    let currentTime = new Date("2026-07-01T08:00:00.000Z");
    const store = new FamilyStore({ dataDir: dir, now: () => currentTime });
    await store.ready;

    const pinned = await store.createPost({ kind: "message", title: "要置顶的旧留言", body: "", authorName: "妈妈" });
    currentTime = new Date("2026-07-01T08:01:00.000Z");
    await store.createPost({ kind: "message", title: "普通新留言", body: "", authorName: "爸爸" });
    currentTime = new Date("2026-07-01T08:02:00.000Z");

    const pinResult = await store.togglePostPin(pinned.post.id, { actorMemberId: "mama" });
    const allPosts = await store.listPosts({ filter: "all" });
    const messagePosts = await store.listPosts({ filter: "message" });

    assert.equal(pinResult.post.pinnedAt, "2026-07-01T08:02:00.000Z");
    assert.equal(pinResult.event.type, "post-pinned");
    assert.deepEqual(allPosts.map((post) => post.title), ["普通新留言", "要置顶的旧留言"]);
    assert.deepEqual(messagePosts.map((post) => post.title), ["要置顶的旧留言", "普通新留言"]);

    const unpinResult = await store.togglePostPin(pinned.post.id, { actorMemberId: "mama" });
    const unpinnedMessages = await store.listPosts({ filter: "message" });

    assert.equal(unpinResult.post.pinnedAt, null);
    assert.equal(unpinResult.event.type, "post-unpinned");
    assert.deepEqual(unpinnedMessages.map((post) => post.title), ["普通新留言", "要置顶的旧留言"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("toggles todo status and records an update event", async () => {
  await withStore(async (store) => {
    const { post } = await store.createPost({ kind: "todo", title: "买牛奶", body: "", authorName: "妈妈" });

    const result = await store.toggleTodo(post.id, { actorMemberId: "baba" });

    assert.equal(result.post.todoStatus, "completed");
    assert.equal(result.post.activityType, "todo-status-updated");
    assert.equal(result.post.activityByMemberId, "baba");
    assert.equal(new Date(result.post.activityAt) > new Date(post.createdAt), true);
    assert.equal(result.event.type, "todo-status-updated");
    assert.equal(result.event.postId, post.id);
    assert.equal(result.event.post.activityType, "todo-status-updated");
  });
});

test("updates post content and records an edit event", async () => {
  await withStore(async (store) => {
    const { post } = await store.createPost({
      kind: "resource",
      title: "旧资料",
      body: "旧说明",
      authorName: "妈妈",
      hasPhoto: true,
      imageUrl: "/uploads/old.png"
    });

    const result = await store.updatePost(post.id, {
      title: "新资料",
      body: "新说明",
      imageUrl: "/uploads/new.png",
      hasPhoto: true,
      actorMemberId: "baba"
    });

    assert.equal(result.post.title, "新资料");
    assert.equal(result.post.body, "新说明");
    assert.equal(result.post.imageUrl, "/uploads/new.png");
    assert.equal(result.post.activityType, "post-updated");
    assert.equal(result.post.activityByMemberId, "baba");
    assert.equal(new Date(result.post.activityAt) > new Date(post.createdAt), true);
    assert.equal(result.event.type, "post-updated");
    assert.equal(result.event.postId, post.id);
    assert.equal(result.event.actorMemberId, "baba");
  });
});

test("deletes posts and records a delete event", async () => {
  await withStore(async (store) => {
    const { post } = await store.createPost({ kind: "message", title: "要删除", body: "旧内容", authorName: "妈妈" });

    const result = await store.deletePost(post.id, { actorMemberId: "baba" });
    const posts = await store.listPosts({ filter: "all" });

    assert.deepEqual(posts, []);
    assert.equal(result.post.title, "要删除");
    assert.equal(result.event.type, "post-deleted");
    assert.equal(result.event.postId, post.id);
    assert.equal(result.event.actorMemberId, "baba");
  });
});

test("persists posts to disk", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "miemie-store-"));
  try {
    const firstStore = new FamilyStore({ dataDir: dir, now: () => new Date("2026-07-01T08:00:00.000Z") });
    await firstStore.ready;
    await firstStore.createPost({ kind: "message", title: "早点回家", body: "", authorName: "妈妈" });

    const secondStore = new FamilyStore({ dataDir: dir });
    await secondStore.ready;
    const posts = await secondStore.listPosts({ filter: "all" });

    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, "早点回家");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("updates member locations and reports distance between two members", async () => {
  await withStore(async (store) => {
    await store.updateMemberLocation({
      memberId: "mama",
      displayName: "妈妈",
      latitude: 31.2304,
      longitude: 121.4737
    });
    await store.updateMemberLocation({
      memberId: "baba",
      displayName: "爸爸",
      latitude: 31.2314,
      longitude: 121.4737
    });

    const status = await store.familyStatus();

    assert.equal(status.members.length, 2);
    assert.equal(status.distanceMeters > 100, true);
    assert.equal(status.distanceMeters < 120, true);
  });
});

test("stores push subscriptions and excludes the acting member", async () => {
  await withStore(async (store) => {
    await store.savePushSubscription({
      memberId: "mama",
      displayName: "妈妈",
      subscription: { endpoint: "https://push.example/mama", keys: { p256dh: "key", auth: "auth" } }
    });
    await store.savePushSubscription({
      memberId: "baba",
      displayName: "爸爸",
      subscription: { endpoint: "https://push.example/baba", keys: { p256dh: "key", auth: "auth" } }
    });

    const subscriptions = await store.listPushSubscriptions({ excludingMemberId: "mama" });

    assert.deepEqual(subscriptions.map((item) => item.memberId), ["baba"]);
    assert.equal(subscriptions[0].subscription.endpoint, "https://push.example/baba");
  });
});

test("adds comments to message posts and records a comment event", async () => {
  await withStore(async (store) => {
    const { post } = await store.createPost({
      kind: "message",
      title: "今晚吃面",
      body: "记得早点回家",
      authorName: "妈妈"
    });

    const result = await store.addComment(post.id, {
      body: "收到 ❤️",
      authorName: "爸爸",
      authorMemberId: "baba"
    });

    assert.equal(result.comment.body, "收到 ❤️");
    assert.equal(result.comment.authorName, "爸爸");
    assert.equal(result.post.comments.length, 1);
    assert.equal(result.event.type, "comment-added");
    assert.equal(result.event.comment.id, result.comment.id);
    assert.equal(result.event.actorMemberId, "baba");
  });
});

test("adds photo comments to message posts", async () => {
  await withStore(async (store) => {
    const { post } = await store.createPost({
      kind: "message",
      title: "看看这个",
      body: "",
      authorName: "妈妈"
    });

    const result = await store.addComment(post.id, {
      body: "",
      imageUrl: "/uploads/reply-photo.png",
      authorName: "爸爸",
      authorMemberId: "baba"
    });

    assert.equal(result.comment.body, "");
    assert.equal(result.comment.imageUrl, "/uploads/reply-photo.png");
    assert.equal(result.post.comments[0].imageUrl, "/uploads/reply-photo.png");
    assert.equal(result.event.comment.imageUrl, "/uploads/reply-photo.png");
  });
});

test("rejects empty comments without a photo", async () => {
  await withStore(async (store) => {
    const { post } = await store.createPost({ kind: "message", title: "今晚吃面", body: "", authorName: "妈妈" });

    await assert.rejects(
      () => store.addComment(post.id, { body: "", authorName: "爸爸", authorMemberId: "baba" }),
      /comment body or photo is required/
    );
  });
});

test("rejects comments on non-message posts", async () => {
  await withStore(async (store) => {
    const { post } = await store.createPost({ kind: "todo", title: "买牛奶", body: "", authorName: "妈妈" });

    await assert.rejects(
      () => store.addComment(post.id, { body: "好", authorName: "爸爸", authorMemberId: "baba" }),
      /message post not found/
    );
  });
});

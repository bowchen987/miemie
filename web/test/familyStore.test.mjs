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

test("toggles todo status and records an update event", async () => {
  await withStore(async (store) => {
    const { post } = await store.createPost({ kind: "todo", title: "买牛奶", body: "", authorName: "妈妈" });

    const result = await store.toggleTodo(post.id);

    assert.equal(result.post.todoStatus, "completed");
    assert.equal(result.event.type, "todo-status-updated");
    assert.equal(result.event.postId, post.id);
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

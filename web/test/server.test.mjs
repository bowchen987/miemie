import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createServer } from "../server/app.mjs";
import { FamilyStore } from "../server/familyStore.mjs";

async function withHttpServer(run, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "miemie-http-"));
  const store = new FamilyStore({ dataDir: dir });
  await store.ready;
  const server = createServer({
    store,
    publicDir: path.join(process.cwd(), "public"),
    familyCode: options.familyCode,
    pushNotifier: options.pushNotifier
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

test("creates and lists posts through the HTTP API", async () => {
  await withHttpServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "message",
        title: "早点回家",
        body: "今晚吃面",
        authorName: "妈妈"
      })
    });

    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.post.title, "早点回家");
    assert.equal(created.event.type, "post-added");

    const listResponse = await fetch(`${baseUrl}/api/posts?filter=message`);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.posts.length, 1);
    assert.equal(list.posts[0].kind, "message");
  });
});

test("protects API routes when a family code is configured", async () => {
  await withHttpServer(async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/posts`);
    assert.equal(denied.status, 401);

    const allowed = await fetch(`${baseUrl}/api/posts`, {
      headers: { "x-miemie-family-code": "secret" }
    });
    assert.equal(allowed.status, 200);

    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
  }, { familyCode: "secret" });
});

test("returns a health check for hosting platforms", async () => {
  await withHttpServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("toggles todos through the HTTP API", async () => {
  await withHttpServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "todo", title: "买牛奶", authorName: "爸爸" })
    });
    const created = await createResponse.json();

    const toggleResponse = await fetch(`${baseUrl}/api/posts/${created.post.id}/toggle`, { method: "PATCH" });

    assert.equal(toggleResponse.status, 200);
    const toggled = await toggleResponse.json();
    assert.equal(toggled.post.todoStatus, "completed");
    assert.equal(toggled.event.type, "todo-status-updated");
  });
});

test("stores uploaded data URLs under the uploads path", async () => {
  await withHttpServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "photo.png",
        dataUrl: "data:image/png;base64,aGVsbG8="
      })
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.match(body.url, /^\/uploads\/.+\.png$/);
  });
});

test("updates member locations through the HTTP API", async () => {
  await withHttpServer(async (baseUrl) => {
    const updateResponse = await fetch(`${baseUrl}/api/members/mama/location`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "妈妈",
        latitude: 31.2304,
        longitude: 121.4737
      })
    });

    assert.equal(updateResponse.status, 200);
    const updateBody = await updateResponse.json();
    assert.equal(updateBody.member.displayName, "妈妈");

    const statusResponse = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.members.length, 1);
  });
});

test("does not send background push notifications for member location updates", async () => {
  const sent = [];

  await withHttpServer(async (baseUrl) => {
    const subscribeResponse = await fetch(`${baseUrl}/api/push/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        memberId: "baba",
        displayName: "爸爸",
        subscription: { endpoint: "https://push.example/baba", keys: { p256dh: "key", auth: "auth" } }
      })
    });
    assert.equal(subscribeResponse.status, 201);

    const updateResponse = await fetch(`${baseUrl}/api/members/mama/location`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "妈妈",
        latitude: 31.2304,
        longitude: 121.4737
      })
    });

    assert.equal(updateResponse.status, 200);
  }, {
    pushNotifier: {
      publicKey: "test-public-key",
      sendNotification: async (subscription, payload) => {
        sent.push({ subscription, payload });
      }
    }
  });

  assert.deepEqual(sent, []);
});

test("registers push subscriptions and notifies other members when posts change", async () => {
  const sent = [];

  await withHttpServer(async (baseUrl) => {
    const keyResponse = await fetch(`${baseUrl}/api/push/public-key`);
    assert.equal(keyResponse.status, 200);
    assert.deepEqual(await keyResponse.json(), { enabled: true, publicKey: "test-public-key" });

    for (const memberId of ["mama", "baba"]) {
      const response = await fetch(`${baseUrl}/api/push/subscriptions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId,
          displayName: memberId === "mama" ? "妈妈" : "爸爸",
          subscription: { endpoint: `https://push.example/${memberId}`, keys: { p256dh: "key", auth: "auth" } }
        })
      });

      assert.equal(response.status, 201);
    }

    const createResponse = await fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "message",
        title: "早点回家",
        body: "今晚吃面",
        authorName: "妈妈",
        authorMemberId: "mama"
      })
    });

    assert.equal(createResponse.status, 201);
  }, {
    pushNotifier: {
      publicKey: "test-public-key",
      sendNotification: async (subscription, payload) => {
        sent.push({ subscription, payload });
      }
    }
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].subscription.endpoint, "https://push.example/baba");
  assert.equal(sent[0].payload.title, "miemie 有新留言");
  assert.equal(sent[0].payload.body, "早点回家");
});

test("adds message comments through the HTTP API and notifies other members", async () => {
  const sent = [];

  await withHttpServer(async (baseUrl) => {
    for (const memberId of ["mama", "baba"]) {
      const response = await fetch(`${baseUrl}/api/push/subscriptions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId,
          displayName: memberId === "mama" ? "妈妈" : "爸爸",
          subscription: { endpoint: `https://push.example/${memberId}`, keys: { p256dh: "key", auth: "auth" } }
        })
      });
      assert.equal(response.status, 201);
    }

    const postResponse = await fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "message",
        title: "今晚吃面",
        body: "早点回家",
        authorName: "妈妈",
        authorMemberId: "mama"
      })
    });
    const created = await postResponse.json();

    const commentResponse = await fetch(`${baseUrl}/api/posts/${created.post.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body: "收到 ❤️",
        authorName: "爸爸",
        authorMemberId: "baba"
      })
    });

    assert.equal(commentResponse.status, 201);
    const commented = await commentResponse.json();
    assert.equal(commented.comment.body, "收到 ❤️");
    assert.equal(commented.event.type, "comment-added");
  }, {
    pushNotifier: {
      publicKey: "test-public-key",
      sendNotification: async (subscription, payload) => {
        sent.push({ subscription, payload });
      }
    }
  });

  assert.equal(sent.length, 2);
  assert.equal(sent[1].subscription.endpoint, "https://push.example/mama");
  assert.equal(sent[1].payload.title, "miemie 有新回复");
  assert.equal(sent[1].payload.body, "爸爸：收到 ❤️");
});

test("adds photo comments through the HTTP API and summarizes push notifications", async () => {
  const sent = [];

  await withHttpServer(async (baseUrl) => {
    for (const memberId of ["mama", "baba"]) {
      const response = await fetch(`${baseUrl}/api/push/subscriptions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId,
          displayName: memberId === "mama" ? "妈妈" : "爸爸",
          subscription: { endpoint: `https://push.example/${memberId}`, keys: { p256dh: "key", auth: "auth" } }
        })
      });
      assert.equal(response.status, 201);
    }

    const postResponse = await fetch(`${baseUrl}/api/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "message",
        title: "今晚吃面",
        body: "早点回家",
        authorName: "妈妈",
        authorMemberId: "mama"
      })
    });
    const created = await postResponse.json();

    const commentResponse = await fetch(`${baseUrl}/api/posts/${created.post.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body: "",
        imageUrl: "/uploads/reply-photo.png",
        authorName: "爸爸",
        authorMemberId: "baba"
      })
    });

    assert.equal(commentResponse.status, 201);
    const commented = await commentResponse.json();
    assert.equal(commented.comment.body, "");
    assert.equal(commented.comment.imageUrl, "/uploads/reply-photo.png");
    assert.equal(commented.event.type, "comment-added");
  }, {
    pushNotifier: {
      publicKey: "test-public-key",
      sendNotification: async (subscription, payload) => {
        sent.push({ subscription, payload });
      }
    }
  });

  assert.equal(sent.length, 2);
  assert.equal(sent[1].subscription.endpoint, "https://push.example/mama");
  assert.equal(sent[1].payload.title, "miemie 有新回复");
  assert.equal(sent[1].payload.body, "爸爸 发来一张照片");
});

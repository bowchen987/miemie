import { createServer as createHttpServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

const MAX_BODY_BYTES = 8 * 1024 * 1024;

const KIND_TITLES = {
  todo: "待办",
  resource: "资料",
  message: "留言",
  photo: "照片"
};

export function createServer({
  store,
  publicDir,
  uploadDir = path.join(store.dataDir, "uploads"),
  familyCode = "",
  pushNotifier = null
}) {
  const events = new Set();
  const requiredFamilyCode = familyCode.trim();

  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/healthz") {
        return sendJson(response, 200, { ok: true });
      }

      if (url.pathname.startsWith("/api/") && !isAuthorized(request, url, requiredFamilyCode)) {
        return sendJson(response, 401, { error: "family code is required" });
      }

      if (request.method === "GET" && url.pathname === "/api/posts") {
        const posts = await store.listPosts({
          filter: url.searchParams.get("filter") ?? "all",
          from: url.searchParams.get("from") ?? "",
          to: url.searchParams.get("to") ?? "",
          tagId: url.searchParams.get("tagId") ?? "",
          q: url.searchParams.get("q") ?? ""
        });
        return sendJson(response, 200, { posts });
      }

      if (request.method === "GET" && url.pathname === "/api/tags") {
        const tags = await store.listTags();
        return sendJson(response, 200, { tags });
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        return sendJson(response, 200, await store.familyStatus());
      }

      if (request.method === "GET" && url.pathname === "/api/push/public-key") {
        return sendJson(response, 200, {
          enabled: Boolean(pushNotifier?.publicKey),
          publicKey: pushNotifier?.publicKey ?? ""
        });
      }

      if (request.method === "POST" && url.pathname === "/api/push/subscriptions") {
        const result = await store.savePushSubscription(await readJson(request));
        return sendJson(response, 201, { subscription: result });
      }

      if (request.method === "POST" && url.pathname === "/api/location-reminders") {
        await sendBackgroundPush({
          store,
          pushNotifier,
          event: locationReminderEvent(await readJson(request))
        });
        return sendJson(response, 200, { ok: true });
      }

      if (request.method === "POST" && url.pathname === "/api/tags") {
        const result = await store.createTag(await readJson(request));
        publish(events, result.event);
        return sendJson(response, 201, result);
      }

      const tagMatch = url.pathname.match(/^\/api\/tags\/([^/]+)$/);
      if (request.method === "PATCH" && tagMatch) {
        const result = await store.updateTag(decodeURIComponent(tagMatch[1]), await readJson(request));
        publish(events, result.event);
        return sendJson(response, 200, result);
      }

      if (request.method === "DELETE" && tagMatch) {
        const result = await store.deleteTag(decodeURIComponent(tagMatch[1]));
        publish(events, result.event);
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/posts") {
        const input = await readJson(request);
        const result = await store.createPost(input);
        await publishChange({ events, store, pushNotifier, event: result.event });
        return sendJson(response, 201, result);
      }

      const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
      if (request.method === "PATCH" && postMatch) {
        const result = await store.updatePost(decodeURIComponent(postMatch[1]), await readJson(request));
        await publishChange({ events, store, pushNotifier, event: result.event });
        return sendJson(response, 200, result);
      }

      if (request.method === "DELETE" && postMatch) {
        const result = await store.deletePost(decodeURIComponent(postMatch[1]), await readJson(request));
        await publishChange({ events, store, pushNotifier, event: result.event });
        return sendJson(response, 200, result);
      }

      const pinMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/pin$/);
      if (request.method === "PATCH" && pinMatch) {
        const result = await store.togglePostPin(decodeURIComponent(pinMatch[1]), await readJson(request));
        await publishChange({ events, store, pushNotifier, event: result.event });
        return sendJson(response, 200, result);
      }

      const toggleMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/toggle$/);
      if (request.method === "PATCH" && toggleMatch) {
        const result = await store.toggleTodo(decodeURIComponent(toggleMatch[1]), await readJson(request));
        await publishChange({ events, store, pushNotifier, event: result.event });
        return sendJson(response, 200, result);
      }

      const commentMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
      if (request.method === "POST" && commentMatch) {
        const result = await store.addComment(decodeURIComponent(commentMatch[1]), await readJson(request));
        await publishChange({ events, store, pushNotifier, event: result.event });
        return sendJson(response, 201, result);
      }

      if (request.method === "POST" && url.pathname === "/api/uploads") {
        const result = await saveUpload(await readJson(request), uploadDir);
        return sendJson(response, 201, result);
      }

      const locationMatch = url.pathname.match(/^\/api\/members\/([^/]+)\/location$/);
      if (request.method === "POST" && locationMatch) {
        const input = await readJson(request);
        const result = await store.updateMemberLocation({
          ...input,
          memberId: decodeURIComponent(locationMatch[1])
        });
        await publishChange({ events, store, pushNotifier, event: result.event });
        return sendJson(response, 200, result);
      }

      if (request.method === "GET" && url.pathname === "/api/events") {
        return openEventStream(response, events);
      }

      if (request.method === "GET") {
        return serveStatic(response, publicDir, uploadDir, url.pathname);
      }

      sendJson(response, 405, { error: "method not allowed" });
    } catch (error) {
      sendJson(response, error.statusCode ?? 400, { error: error.message });
    }
  });
}

function isAuthorized(request, url, requiredFamilyCode) {
  if (!requiredFamilyCode) {
    return true;
  }

  return (
    request.headers["x-miemie-family-code"] === requiredFamilyCode ||
    url.searchParams.get("familyCode") === requiredFamilyCode
  );
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function publish(events, event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const response of events) {
    response.write(payload);
  }
}

async function publishChange({ events, store, pushNotifier, event }) {
  publish(events, event);
  await sendBackgroundPush({ store, pushNotifier, event });
}

async function sendBackgroundPush({ store, pushNotifier, event }) {
  if (!pushNotifier) {
    return;
  }

  const payload = pushPayloadForEvent(event);
  if (!payload) {
    return;
  }

  const subscriptions = await store.listPushSubscriptions({ excludingMemberId: actorMemberIdForEvent(event) });
  await Promise.all(
    subscriptions.map((item) => pushNotifier.sendNotification(item.subscription, payload).catch(() => {}))
  );
}

function actorMemberIdForEvent(event) {
  return event.actorMemberId ?? event.post?.authorMemberId ?? event.member?.id ?? "";
}

function locationReminderEvent(input = {}) {
  const actorName = String(input.actorName ?? "").trim() || "对方";
  return {
    type: "location-sync-reminder",
    actorMemberId: String(input.actorMemberId ?? "").trim(),
    actorName
  };
}

function pushPayloadForEvent(event) {
  if (event.type === "location-sync-reminder") {
    return {
      title: "miemie 提醒同步位置",
      body: `${event.actorName} 想让你同步一下位置`,
      url: "/"
    };
  }
  if (event.type === "post-added") {
    return {
      title: `miemie 有新${KIND_TITLES[event.post.kind] || "内容"}`,
      body: event.post.title,
      url: "/"
    };
  }
  if (event.type === "todo-status-updated") {
    return {
      title: "miemie 待办状态更新",
      body: `${event.post.title}：${event.post.todoStatus === "completed" ? "已完成" : "未完成"}`,
      url: "/"
    };
  }
  if (event.type === "post-updated") {
    return {
      title: `miemie ${KIND_TITLES[event.post.kind] || "内容"}已更新`,
      body: event.post.title,
      url: "/"
    };
  }
  if (event.type === "post-deleted") {
    return {
      title: `miemie ${KIND_TITLES[event.post.kind] || "内容"}已删除`,
      body: event.post.title,
      url: "/"
    };
  }
  if (event.type === "post-pinned") {
    return {
      title: `miemie ${KIND_TITLES[event.post.kind] || "内容"}已置顶`,
      body: event.post.title,
      url: "/"
    };
  }
  if (event.type === "post-unpinned") {
    return {
      title: `miemie ${KIND_TITLES[event.post.kind] || "内容"}已取消置顶`,
      body: event.post.title,
      url: "/"
    };
  }
  if (event.type === "comment-added") {
    return {
      title: "miemie 有新回复",
      body: commentNotificationBody(event.comment),
      url: "/"
    };
  }
  return null;
}

function commentNotificationBody(comment) {
  if (comment.body) {
    return `${comment.authorName}：${comment.body}`;
  }
  if (comment.imageUrl) {
    return `${comment.authorName} 发来一张照片`;
  }
  return `${comment.authorName} 回复了`;
}

function openEventStream(response, events) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive"
  });
  response.write(": connected\n\n");
  events.add(response);
  response.on("close", () => events.delete(response));
}

async function saveUpload(input, uploadDir) {
  const match = String(input.dataUrl ?? "").match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) {
    throw new Error("image dataUrl is required");
  }

  const extension = extensionForMimeType(match[1]);
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(uploadDir, fileName);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, Buffer.from(match[2], "base64"));

  return { url: `/uploads/${fileName}` };
}

function extensionForMimeType(mimeType) {
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  if (mimeType === "image/webp") {
    return ".webp";
  }
  return ".png";
}

async function serveStatic(response, publicDir, uploadDir, pathname) {
  const filePath = resolveStaticPath(publicDir, uploadDir, pathname);
  if (!filePath) {
    return sendJson(response, 404, { error: "not found" });
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      "content-type": MIME_TYPES.get(path.extname(filePath)) ?? "application/octet-stream"
    });
    response.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return sendJson(response, 404, { error: "not found" });
    }
    throw error;
  }
}

function resolveStaticPath(publicDir, uploadDir, pathname) {
  if (pathname.startsWith("/uploads/")) {
    return safeJoin(uploadDir, pathname.slice("/uploads/".length));
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  return safeJoin(publicDir, relativePath);
}

function safeJoin(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  return resolvedPath.startsWith(resolvedRoot) ? resolvedPath : null;
}

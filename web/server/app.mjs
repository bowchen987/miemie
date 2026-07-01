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

export function createServer({ store, publicDir, uploadDir = path.join(store.dataDir, "uploads"), familyCode = "" }) {
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
        const posts = await store.listPosts({ filter: url.searchParams.get("filter") ?? "all" });
        return sendJson(response, 200, { posts });
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        return sendJson(response, 200, await store.familyStatus());
      }

      if (request.method === "POST" && url.pathname === "/api/posts") {
        const input = await readJson(request);
        const result = await store.createPost(input);
        publish(events, result.event);
        return sendJson(response, 201, result);
      }

      const toggleMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/toggle$/);
      if (request.method === "PATCH" && toggleMatch) {
        const result = await store.toggleTodo(decodeURIComponent(toggleMatch[1]));
        publish(events, result.event);
        return sendJson(response, 200, result);
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
        publish(events, result.event);
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

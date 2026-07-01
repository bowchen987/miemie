import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const VALID_KINDS = new Set(["todo", "resource", "message", "photo"]);
const VALID_FILTERS = new Set(["all", "todo", "resource", "message"]);

export class FamilyStore {
  constructor({ dataDir = path.join(process.cwd(), "data"), now = () => new Date() } = {}) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, "family-posts.json");
    this.now = now;
    this.posts = [];
    this.members = {};
    this.ready = this.load();
  }

  async listPosts({ filter = "all" } = {}) {
    this.assertFilter(filter);
    return this.posts
      .filter((post) => this.includesFilter(post, filter))
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  async createPost(input) {
    const kind = this.normalizeKind(input.kind);
    const title = this.clean(input.title);
    const body = this.clean(input.body);
    const authorName = this.clean(input.authorName) || "我";

    if (!title) {
      throw new Error("title is required");
    }

    const post = {
      id: randomUUID(),
      kind,
      todoStatus: kind === "todo" ? "incomplete" : null,
      title,
      body,
      authorName,
      createdAt: this.now().toISOString(),
      hasPhoto: Boolean(input.hasPhoto),
      imageUrl: input.imageUrl ?? null
    };

    this.posts.push(post);
    await this.save();

    return {
      post,
      event: this.event("post-added", post)
    };
  }

  async toggleTodo(id) {
    const post = this.posts.find((item) => item.id === id);
    if (!post || post.kind !== "todo") {
      throw new Error("todo not found");
    }

    post.todoStatus = post.todoStatus === "completed" ? "incomplete" : "completed";
    await this.save();

    return {
      post,
      event: this.event("todo-status-updated", post)
    };
  }

  async updateMemberLocation(input) {
    const memberId = this.clean(input.memberId);
    const displayName = this.clean(input.displayName) || memberId;
    const latitude = Number(input.latitude);
    const longitude = Number(input.longitude);

    if (!memberId) {
      throw new Error("memberId is required");
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("valid coordinates are required");
    }

    const member = {
      id: memberId,
      displayName,
      latitude,
      longitude,
      updatedAt: this.now().toISOString()
    };
    this.members[memberId] = member;
    await this.save();

    return {
      member,
      event: {
        id: randomUUID(),
        type: "member-location-updated",
        member,
        createdAt: this.now().toISOString()
      }
    };
  }

  async familyStatus() {
    const members = Object.values(this.members).sort((left, right) => left.displayName.localeCompare(right.displayName));
    return {
      members,
      distanceMeters: this.distanceBetweenFirstTwoMembers(members)
    };
  }

  async load() {
    await mkdir(this.dataDir, { recursive: true });

    try {
      const raw = await readFile(this.filePath, "utf8");
      const data = JSON.parse(raw);
      this.posts = Array.isArray(data.posts) ? data.posts : [];
      this.members = data.members && typeof data.members === "object" ? data.members : {};
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      this.posts = [];
      this.members = {};
      await this.save();
    }
  }

  async save() {
    await writeFile(this.filePath, JSON.stringify({ posts: this.posts, members: this.members }, null, 2));
  }

  clean(value) {
    return String(value ?? "").trim();
  }

  normalizeKind(kind) {
    if (!VALID_KINDS.has(kind)) {
      throw new Error("invalid kind");
    }
    return kind;
  }

  assertFilter(filter) {
    if (!VALID_FILTERS.has(filter)) {
      throw new Error("invalid filter");
    }
  }

  includesFilter(post, filter) {
    if (filter === "all") {
      return true;
    }
    if (filter === "resource") {
      return post.kind === "resource" || post.kind === "photo";
    }
    return post.kind === filter;
  }

  event(type, post) {
    return {
      id: randomUUID(),
      type,
      postId: post.id,
      post,
      createdAt: this.now().toISOString()
    };
  }

  distanceBetweenFirstTwoMembers(members) {
    if (members.length < 2) {
      return null;
    }

    return Math.round(distanceMeters(members[0], members[1]));
  }
}

function distanceMeters(left, right) {
  const earthRadiusMeters = 6_371_000;
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

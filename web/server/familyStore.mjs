import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const VALID_KINDS = new Set(["todo", "resource", "message", "photo"]);
const VALID_FILTERS = new Set(["all", "todo", "resource", "message"]);
const RESOURCE_KINDS = new Set(["resource", "photo"]);
const UNTAGGED_RESOURCE_FILTER = "__untagged";

export class FamilyStore {
  constructor({ dataDir = path.join(process.cwd(), "data"), now = () => new Date() } = {}) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, "family-posts.json");
    this.now = now;
    this.posts = [];
    this.tags = [];
    this.members = {};
    this.pushSubscriptions = [];
    this.ready = this.load();
  }

  async listPosts({ filter = "all", from = "", to = "", tagId = "", q = "" } = {}) {
    this.assertFilter(filter);
    const range = this.dateRange({ from, to });
    const searchText = this.clean(q).toLowerCase();
    return this.posts
      .filter((post) => this.includesFilter(post, filter))
      .filter((post) => this.includesDateRange(post, range))
      .filter((post) => this.includesResourceTag(post, filter, tagId))
      .filter((post) => this.includesSearchText(post, searchText))
      .sort((left, right) => this.comparePosts(left, right, filter));
  }

  async listTags() {
    return [...this.tags].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
  }

  async createTag(input = {}) {
    const name = this.clean(input.name);
    if (!name) {
      throw new Error("tag name is required");
    }

    const createdAt = this.now().toISOString();
    const tag = {
      id: randomUUID(),
      name,
      createdAt,
      updatedAt: createdAt
    };
    this.tags.push(tag);
    await this.save();

    return {
      tag,
      event: {
        id: randomUUID(),
        type: "tag-added",
        tag,
        createdAt
      }
    };
  }

  async updateTag(id, input = {}) {
    const tag = this.tags.find((item) => item.id === id);
    if (!tag) {
      throw new Error("tag not found");
    }

    const name = this.clean(input.name);
    if (!name) {
      throw new Error("tag name is required");
    }

    tag.name = name;
    tag.updatedAt = this.now().toISOString();
    await this.save();

    return {
      tag,
      event: {
        id: randomUUID(),
        type: "tag-updated",
        tag,
        createdAt: tag.updatedAt
      }
    };
  }

  async deleteTag(id) {
    const index = this.tags.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("tag not found");
    }

    const [tag] = this.tags.splice(index, 1);
    for (const post of this.posts) {
      if (Array.isArray(post.tagIds)) {
        post.tagIds = post.tagIds.filter((tagId) => tagId !== id);
      }
    }
    const deletedAt = this.now().toISOString();
    await this.save();

    return {
      tag,
      event: {
        id: randomUUID(),
        type: "tag-deleted",
        tag,
        createdAt: deletedAt
      }
    };
  }

  async createPost(input) {
    const kind = this.normalizeKind(input.kind);
    const title = this.clean(input.title);
    const body = this.clean(input.body);
    const authorName = this.clean(input.authorName) || "我";
    const authorMemberId = this.clean(input.authorMemberId) || null;

    if (!title) {
      throw new Error("title is required");
    }

    const createdAt = this.now().toISOString();
    const post = {
      id: randomUUID(),
      kind,
      todoStatus: kind === "todo" ? "incomplete" : null,
      title,
      body,
      authorName,
      authorMemberId,
      createdAt,
      activityAt: createdAt,
      activityByMemberId: authorMemberId,
      activityType: "post-added",
      pinnedAt: null,
      tagIds: this.cleanTagIds(input.tagIds, kind),
      hasPhoto: Boolean(input.hasPhoto),
      imageUrl: input.imageUrl ?? null,
      comments: []
    };

    this.posts.push(post);
    await this.save();

    return {
      post,
      event: this.event("post-added", post)
    };
  }

  async toggleTodo(id, input = {}) {
    const post = this.posts.find((item) => item.id === id);
    if (!post || post.kind !== "todo") {
      throw new Error("todo not found");
    }

    const actorMemberId = this.clean(input.actorMemberId) || null;
    post.todoStatus = post.todoStatus === "completed" ? "incomplete" : "completed";
    post.activityAt = this.now().toISOString();
    post.activityByMemberId = actorMemberId;
    post.activityType = "todo-status-updated";
    await this.save();

    return {
      post,
      event: {
        ...this.event("todo-status-updated", post),
        actorMemberId
      }
    };
  }

  async updatePost(id, input = {}) {
    const post = this.posts.find((item) => item.id === id);
    if (!post) {
      throw new Error("post not found");
    }

    const title = this.clean(input.title);
    const body = this.clean(input.body);
    if (!title) {
      throw new Error("title is required");
    }

    const actorMemberId = this.clean(input.actorMemberId) || null;
    post.title = title;
    post.body = body;
    if (Object.hasOwn(input, "imageUrl")) {
      post.imageUrl = this.clean(input.imageUrl) || null;
    }
    if (Object.hasOwn(input, "hasPhoto")) {
      post.hasPhoto = Boolean(input.hasPhoto);
    } else {
      post.hasPhoto = Boolean(post.imageUrl);
    }
    if (Object.hasOwn(input, "tagIds")) {
      post.tagIds = this.cleanTagIds(input.tagIds, post.kind);
    }
    post.activityAt = this.now().toISOString();
    post.activityByMemberId = actorMemberId;
    post.activityType = "post-updated";
    await this.save();

    return {
      post,
      event: {
        ...this.event("post-updated", post),
        actorMemberId
      }
    };
  }

  async togglePostPin(id, input = {}) {
    const post = this.posts.find((item) => item.id === id);
    if (!post) {
      throw new Error("post not found");
    }

    const actorMemberId = this.clean(input.actorMemberId) || null;
    const changedAt = this.now().toISOString();
    const pinned = !post.pinnedAt;
    post.pinnedAt = pinned ? changedAt : null;
    post.activityAt = changedAt;
    post.activityByMemberId = actorMemberId;
    post.activityType = pinned ? "post-pinned" : "post-unpinned";
    await this.save();

    return {
      post,
      event: {
        ...this.event(post.activityType, post),
        actorMemberId
      }
    };
  }

  async deletePost(id, input = {}) {
    const index = this.posts.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("post not found");
    }

    const actorMemberId = this.clean(input.actorMemberId) || null;
    const [post] = this.posts.splice(index, 1);
    await this.save();

    return {
      post,
      event: {
        ...this.event("post-deleted", post),
        actorMemberId
      }
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

  async addComment(postId, input) {
    const post = this.posts.find((item) => item.id === postId && item.kind === "message");
    if (!post) {
      throw new Error("message post not found");
    }

    const body = this.clean(input.body);
    const imageUrl = this.clean(input.imageUrl) || null;
    const authorName = this.clean(input.authorName) || "我";
    const authorMemberId = this.clean(input.authorMemberId) || null;
    if (!body && !imageUrl) {
      throw new Error("comment body or photo is required");
    }

    const comment = {
      id: randomUUID(),
      body,
      imageUrl,
      authorName,
      authorMemberId,
      createdAt: this.now().toISOString()
    };
    post.comments = Array.isArray(post.comments) ? post.comments : [];
    post.comments.push(comment);
    await this.save();

    return {
      post,
      comment,
      event: {
        id: randomUUID(),
        type: "comment-added",
        postId: post.id,
        post,
        comment,
        actorMemberId: authorMemberId,
        createdAt: this.now().toISOString()
      }
    };
  }

  async savePushSubscription(input) {
    const memberId = this.clean(input.memberId);
    const displayName = this.clean(input.displayName) || memberId || "我";
    const subscription = input.subscription;
    const endpoint = this.clean(subscription?.endpoint);

    if (!memberId) {
      throw new Error("memberId is required");
    }
    if (!endpoint) {
      throw new Error("push subscription endpoint is required");
    }

    const item = {
      memberId,
      displayName,
      subscription,
      updatedAt: this.now().toISOString()
    };
    this.pushSubscriptions = this.pushSubscriptions.filter((existing) => existing.subscription?.endpoint !== endpoint);
    this.pushSubscriptions.push(item);
    await this.save();

    return item;
  }

  async listPushSubscriptions({ excludingMemberId = "" } = {}) {
    return this.pushSubscriptions.filter((item) => item.memberId !== excludingMemberId);
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
      this.posts = Array.isArray(data.posts)
        ? data.posts.map((post) => ({ comments: [], pinnedAt: null, tagIds: [], ...post }))
        : [];
      this.tags = Array.isArray(data.tags) ? data.tags : [];
      this.members = data.members && typeof data.members === "object" ? data.members : {};
      this.pushSubscriptions = Array.isArray(data.pushSubscriptions) ? data.pushSubscriptions : [];
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      this.posts = [];
      this.tags = [];
      this.members = {};
      this.pushSubscriptions = [];
      await this.save();
    }
  }

  async save() {
    await writeFile(
      this.filePath,
      JSON.stringify(
        { posts: this.posts, tags: this.tags, members: this.members, pushSubscriptions: this.pushSubscriptions },
        null,
        2
      )
    );
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

  includesResourceTag(post, filter, tagId) {
    const normalizedTagId = this.clean(tagId);
    if (filter !== "resource" || !normalizedTagId) {
      return true;
    }

    const tagIds = Array.isArray(post.tagIds) ? post.tagIds : [];
    if (normalizedTagId === UNTAGGED_RESOURCE_FILTER) {
      return tagIds.length === 0;
    }

    return tagIds.includes(normalizedTagId);
  }

  includesSearchText(post, searchText) {
    if (!searchText) {
      return true;
    }

    return `${post.title ?? ""} ${post.body ?? ""}`.toLowerCase().includes(searchText);
  }

  comparePosts(left, right, filter) {
    if (filter === "todo" && left.todoStatus !== right.todoStatus) {
      return left.todoStatus === "incomplete" ? -1 : 1;
    }

    if (filter !== "all" && Boolean(left.pinnedAt) !== Boolean(right.pinnedAt)) {
      return left.pinnedAt ? -1 : 1;
    }

    return new Date(right.createdAt) - new Date(left.createdAt);
  }

  cleanTagIds(tagIds, kind) {
    if (!RESOURCE_KINDS.has(kind) || !Array.isArray(tagIds)) {
      return [];
    }

    const knownTagIds = new Set(this.tags.map((tag) => tag.id));
    return [...new Set(tagIds.map((tagId) => this.clean(tagId)).filter((tagId) => knownTagIds.has(tagId)))];
  }

  dateRange({ from, to }) {
    if (!from && !to) {
      return null;
    }

    const start = from ? new Date(from) : null;
    const end = to ? new Date(to) : null;
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      throw new Error("invalid date range");
    }

    return { start, end };
  }

  includesDateRange(post, range) {
    if (!range) {
      return true;
    }

    const createdAt = new Date(post.createdAt);
    return (!range.start || createdAt >= range.start) && (!range.end || createdAt < range.end);
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

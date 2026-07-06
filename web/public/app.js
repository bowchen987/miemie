import { notificationButtonText } from "./notificationUi.js";
import { formatRelativeTime, formatTime } from "./timeFormat.js";

const KIND_TITLES = {
  todo: "待办",
  resource: "资料",
  message: "留言",
  photo: "照片"
};

const FILTER_TITLES = {
  all: "今天的小纸条",
  todo: "全部待办",
  resource: "全部资料",
  message: "全部留言"
};

const RESOURCE_KINDS = new Set(["resource", "photo"]);
const UNTAGGED_RESOURCE_FILTER = "__untagged";

const EMOTIONAL_STATUS_COPY = {
  empty: [
    "打开定位后，小家距离会亮起来",
    "同步一次位置，就能看见彼此距离",
    "小家还在等第一次定位",
    "点同步位置，把小家点亮"
  ],
  single: [
    "已经收到{name}的位置，等待另一位",
    "已经收到一个人的位置啦",
    "小家亮了一半，等另一位也来一下",
    "再同步一位，就能看到距离了"
  ],
  close: [
    "今天也在彼此附近",
    "离得很近，小家很安心",
    "你们刚好在彼此身边",
    "小家距离很近，今天也稳稳的"
  ],
  fresh: [
    "刚刚同步过位置",
    "小家刚刚亮了一下",
    "位置刚刚更新过",
    "位置是新鲜的，安心"
  ],
  far: [
    "距离有点远，但小家在线",
    "人在远处，心在小家",
    "虽然隔着一段路，小家还连着",
    "远一点也没关系，miemie 在这里"
  ],
  stale: [
    "{name}有一会儿没同步了，点一下刷新位置吧",
    "等{name}一次新的同步，小家会更安心",
    "小家在等{name}新的同步",
    "点一下同步，让小家安心一点"
  ],
  fallback: [
    "小家正在等一次新的同步",
    "点一下同步，让小家更新一下",
    "miemie 正在等新的位置信息"
  ]
};

const COMMENT_EMOJIS = ["❤️", "👍", "😂", "🥰", "👏", "🙏"];
const COMMENT_PHOTO_PICKER_RETURN_WINDOW_MS = 10 * 60 * 1000;
const COMMENT_PHOTO_PICKER_SETTLE_MS = 1500;
const NEW_BADGE_VISIBLE_MS = 1400;
const POST_ACTION_CLICK_SUPPRESS_MS = 320;
const POST_ACTION_SWIPE_THRESHOLD = 44;
const POST_READ_STATE_KEY = "miemie.postReadState";
const UPLOAD_IMAGE_MAX_EDGE = 1600;
const UPLOAD_IMAGE_QUALITY = 0.82;

const state = {
  filter: "all",
  composeKind: "message",
  editingPostId: null,
  resourceSearch: "",
  resourceTagFilter: "all",
  selectedResourceTagIds: [],
  tags: [],
  filterBadgePosts: {
    todo: [],
    resource: [],
    message: []
  },
  posts: [],
  memberId: localStorage.getItem("miemie.memberId") || crypto.randomUUID(),
  displayName: localStorage.getItem("miemie.displayName") || "",
  familyCode: localStorage.getItem("miemie.familyCode") || ""
};

localStorage.setItem("miemie.memberId", state.memberId);
let eventSource;
let serviceWorkerRegistration;
let lastResumeRefreshAt = Date.now();
let commentPhotoPickerOpenedAt = 0;
let commentPhotoPickerClearTimer;
let postReadState = loadPostReadState();
let activePostActionCard = null;
let postActionClickSuppressUntil = 0;
const commentPhotoRefreshers = new Set();

const elements = {
  connectionState: document.querySelector("#connectionState"),
  composer: document.querySelector("#composer"),
  composerTitle: document.querySelector("#composerTitle"),
  displayNameInput: document.querySelector("#displayNameInput"),
  distanceText: document.querySelector("#distanceText"),
  enableNotifyButton: document.querySelector("#enableNotifyButton"),
  accessPanel: document.querySelector("#accessPanel"),
  familyCodeInput: document.querySelector("#familyCodeInput"),
  feedList: document.querySelector("#feedList"),
  feedTitle: document.querySelector("#feedTitle"),
  identityPanel: document.querySelector("#identityPanel"),
  composerTagList: document.querySelector("#composerTagList"),
  createTagButton: document.querySelector("#createTagButton"),
  newTagInput: document.querySelector("#newTagInput"),
  photoInput: document.querySelector("#photoInput"),
  postBodyInput: document.querySelector("#postBodyInput"),
  postForm: document.querySelector("#postForm"),
  postTemplate: document.querySelector("#postTemplate"),
  postTitleInput: document.querySelector("#postTitleInput"),
  postSubmitButton: document.querySelector("#postForm button[type='submit']"),
  resourceArchiveTools: document.querySelector("#resourceArchiveTools"),
  resourceSearchInput: document.querySelector("#resourceSearchInput"),
  resourceTagFilters: document.querySelector("#resourceTagFilters"),
  resourceTagPicker: document.querySelector("#resourceTagPicker"),
  saveNameButton: document.querySelector("#saveNameButton"),
  saveFamilyCodeButton: document.querySelector("#saveFamilyCodeButton"),
  shareLocationButton: document.querySelector("#shareLocationButton"),
  statusText: document.querySelector("#statusText"),
  syncDetailText: document.querySelector("#syncDetailText")
};

init();

async function init() {
  elements.displayNameInput.value = state.displayName;
  elements.familyCodeInput.value = state.familyCode;
  elements.identityPanel.hidden = Boolean(state.displayName);
  bindEvents();
  serviceWorkerRegistration = await registerServiceWorker();
  await refreshNotificationButton();
  try {
    await refreshAll();
    await syncCurrentLocation({ quiet: true });
    lastResumeRefreshAt = Date.now();
    connectEvents();
  } catch (error) {
    if (error.message !== "family code is required") {
      throw error;
    }
  }
}

function bindEvents() {
  document.querySelectorAll("[data-compose-kind]").forEach((button) => {
    button.addEventListener("click", () => openComposer(button.dataset.composeKind));
  });

  document.querySelector("#closeComposerButton").addEventListener("click", closeComposer);

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      updateFilterTabs();
      renderResourceArchiveTools();
      loadPosts();
    });
  });

  elements.postForm.addEventListener("submit", submitPost);
  elements.createTagButton.addEventListener("click", createResourceTagFromComposer);
  elements.newTagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      createResourceTagFromComposer();
    }
  });
  elements.resourceSearchInput.addEventListener("input", () => {
    state.resourceSearch = elements.resourceSearchInput.value.trim();
    loadPosts();
  });
  elements.saveNameButton.addEventListener("click", saveDisplayName);
  elements.saveFamilyCodeButton.addEventListener("click", saveFamilyCode);
  elements.shareLocationButton.addEventListener("click", shareLocation);
  elements.enableNotifyButton.addEventListener("click", requestNotificationPermission);
  document.addEventListener("click", closePostActionMenuFromAnyClick, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideActivePostActionMenu();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshAfterResume();
      refreshCommentPhotoSelections();
    }
  });
  window.addEventListener("pageshow", refreshAfterResume);
  window.addEventListener("pageshow", refreshCommentPhotoSelections);
  window.addEventListener("focus", refreshAfterResume);
  window.addEventListener("focus", refreshCommentPhotoSelections);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    return navigator.serviceWorker.register("/sw.js").catch(() => null);
  }
  return Promise.resolve(null);
}

function openComposer(kind, post = null) {
  state.composeKind = kind;
  state.editingPostId = post?.id ?? null;
  state.selectedResourceTagIds = RESOURCE_KINDS.has(kind) && Array.isArray(post?.tagIds) ? [...post.tagIds] : [];
  elements.composerTitle.textContent = `${post ? "编辑" : "发布"}${KIND_TITLES[kind]}`;
  elements.postTitleInput.placeholder = placeholderForKind(kind);
  elements.postBodyInput.value = post?.body ?? "";
  elements.postTitleInput.value = post?.title ?? "";
  elements.photoInput.value = "";
  elements.newTagInput.value = "";
  elements.resourceTagPicker.hidden = !RESOURCE_KINDS.has(kind);
  renderComposerTagPicker();
  if (post) {
    elements.postSubmitButton.textContent = "保存修改";
  } else {
    elements.postSubmitButton.textContent = "发布到 miemie";
  }
  elements.composer.hidden = false;
  elements.postTitleInput.focus();
}

function closeComposer() {
  state.editingPostId = null;
  state.selectedResourceTagIds = [];
  elements.composer.hidden = true;
  elements.resourceTagPicker.hidden = true;
  elements.postSubmitButton.textContent = "发布到 miemie";
}

function placeholderForKind(kind) {
  if (kind === "todo") {
    return "要一起完成什么？";
  }
  if (kind === "resource") {
    return "要归档什么资料？";
  }
  return "想留一句什么话？";
}

async function submitPost(event) {
  event.preventDefault();
  if (!ensureDisplayName()) {
    return;
  }

  const title = elements.postTitleInput.value.trim();
  const body = elements.postBodyInput.value.trim();
  if (!title) {
    elements.postTitleInput.focus();
    return;
  }

  const file = elements.photoInput.files[0];
  const imageUrl = file ? await uploadImage(file) : null;

  if (state.editingPostId) {
    const updateBody = {
      title,
      body,
      actorMemberId: state.memberId
    };
    if (RESOURCE_KINDS.has(state.composeKind)) {
      updateBody.tagIds = selectedResourceTagIds();
    }
    if (file) {
      updateBody.hasPhoto = Boolean(imageUrl);
      updateBody.imageUrl = imageUrl;
    }

    await api(`/api/posts/${encodeURIComponent(state.editingPostId)}`, {
      method: "PATCH",
      body: updateBody
    });
  } else {
    await api("/api/posts", {
      method: "POST",
      body: {
        kind: state.composeKind,
        title,
        body,
        authorName: state.displayName,
        authorMemberId: state.memberId,
        tagIds: selectedResourceTagIds(),
        hasPhoto: Boolean(imageUrl),
        imageUrl
      }
    });
  }

  closeComposer();
  await loadPosts();
  await loadFilterBadges();
}

async function uploadImage(file) {
  const dataUrl = await prepareImageForUpload(file);
  const result = await api("/api/uploads", {
    method: "POST",
    body: {
      fileName: file.name,
      dataUrl
    }
  });
  return result.url;
}

async function prepareImageForUpload(file) {
  const dataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/")) {
    return dataUrl;
  }

  try {
    const image = await loadImage(dataUrl);
    const scale = Math.min(1, UPLOAD_IMAGE_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", UPLOAD_IMAGE_QUALITY);
  } catch {
    return dataUrl;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = dataUrl;
  });
}

async function loadTags() {
  const result = await api("/api/tags");
  state.tags = Array.isArray(result.tags) ? result.tags : [];
  state.selectedResourceTagIds = selectedResourceTagIds();
  renderResourceArchiveTools();
  renderComposerTagPicker();
}

function renderResourceArchiveTools() {
  elements.resourceArchiveTools.hidden = state.filter !== "resource";
  if (elements.resourceArchiveTools.hidden) {
    return;
  }

  if (document.activeElement !== elements.resourceSearchInput) {
    elements.resourceSearchInput.value = state.resourceSearch;
  }

  elements.resourceTagFilters.replaceChildren(
    resourceTagFilterButton("all", "全部"),
    resourceTagFilterButton(UNTAGGED_RESOURCE_FILTER, "未打标签")
  );
  for (const tag of state.tags) {
    elements.resourceTagFilters.append(resourceTagFilterButton(tag.id, tag.name));
  }
}

function resourceTagFilterButton(value, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "resource-tag-chip";
  button.classList.toggle("active", state.resourceTagFilter === value);
  button.textContent = label;
  button.addEventListener("click", () => {
    state.resourceTagFilter = value;
    renderResourceArchiveTools();
    loadPosts();
  });
  return button;
}

function resourceTagManagementGroup(tag) {
  const group = document.createElement("span");
  group.className = "resource-tag-chip-group";

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "resource-tag-chip";
  selectButton.classList.toggle("active", selectedResourceTagIds().includes(tag.id));
  selectButton.textContent = tag.name;
  selectButton.addEventListener("click", () => {
    toggleSelectedResourceTag(tag.id);
    renderComposerTagPicker();
  });

  const renameButton = document.createElement("button");
  renameButton.type = "button";
  renameButton.className = "tag-icon-button";
  renameButton.textContent = "✎";
  renameButton.title = "重命名标签";
  renameButton.setAttribute("aria-label", `重命名标签${tag.name}`);
  renameButton.addEventListener("click", () => renameResourceTag(tag));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "tag-icon-button delete-tag-button";
  deleteButton.textContent = "×";
  deleteButton.title = "删除标签";
  deleteButton.setAttribute("aria-label", `删除标签${tag.name}`);
  deleteButton.addEventListener("click", () => deleteResourceTag(tag));

  group.append(selectButton, renameButton, deleteButton);
  return group;
}

function renderComposerTagPicker() {
  elements.composerTagList.replaceChildren();
  if (elements.resourceTagPicker.hidden) {
    return;
  }

  for (const tag of state.tags) {
    elements.composerTagList.append(resourceTagManagementGroup(tag));
  }
}

function toggleSelectedResourceTag(tagId) {
  if (state.selectedResourceTagIds.includes(tagId)) {
    state.selectedResourceTagIds = state.selectedResourceTagIds.filter((id) => id !== tagId);
    return;
  }

  state.selectedResourceTagIds = [...state.selectedResourceTagIds, tagId];
}

function selectedResourceTagIds() {
  const knownTagIds = new Set(state.tags.map((tag) => tag.id));
  return state.selectedResourceTagIds.filter((tagId) => knownTagIds.has(tagId));
}

async function createResourceTagFromComposer() {
  const name = elements.newTagInput.value.trim();
  if (!name) {
    elements.newTagInput.focus();
    return;
  }

  const result = await api("/api/tags", {
    method: "POST",
    body: { name }
  });
  state.tags = [...state.tags, result.tag];
  state.selectedResourceTagIds = [...selectedResourceTagIds(), result.tag.id];
  elements.newTagInput.value = "";
  renderComposerTagPicker();
  renderResourceArchiveTools();
}

async function renameResourceTag(tag) {
  const name = window.prompt("修改标签名称", tag.name);
  if (name === null) {
    return;
  }
  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  await api(`/api/tags/${encodeURIComponent(tag.id)}`, {
    method: "PATCH",
    body: { name: trimmedName }
  });
  await loadTags();
  renderPosts();
}

async function deleteResourceTag(tag) {
  if (!window.confirm(`删除标签「${tag.name}」吗？资料不会被删除。`)) {
    return;
  }

  await api(`/api/tags/${encodeURIComponent(tag.id)}`, { method: "DELETE" });
  if (state.resourceTagFilter === tag.id) {
    state.resourceTagFilter = "all";
  }
  state.selectedResourceTagIds = state.selectedResourceTagIds.filter((tagId) => tagId !== tag.id);
  await loadTags();
  await loadPosts();
  await loadFilterBadges();
}

async function loadPosts() {
  const params = new URLSearchParams({ filter: state.filter });
  if (state.filter === "all") {
    for (const [key, value] of todayRangeParams()) {
      params.set(key, value);
    }
  }
  if (state.filter === "resource" && state.resourceTagFilter !== "all") {
    params.set("tagId", state.resourceTagFilter);
  }
  if (state.filter === "resource" && state.resourceSearch) {
    params.set("q", state.resourceSearch);
  }

  const result = await api(`/api/posts?${params}`);
  state.posts = result.posts;
  renderPosts();
}

function todayRangeParams() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return [
    ["from", start.toISOString()],
    ["to", end.toISOString()]
  ];
}

async function refreshAll() {
  await loadTags();
  await Promise.all([loadPosts(), loadStatus(), loadFilterBadges()]);
}

async function refreshAfterResume() {
  if (document.visibilityState === "hidden") {
    return;
  }

  if (hasPendingCommentPhotoSelection() || isCommentPhotoPickerReturning()) {
    refreshCommentPhotoSelections();
    settleCommentPhotoPickerReturn();
    await syncCurrentLocation({ quiet: true });
    return;
  }

  const now = Date.now();
  if (now - lastResumeRefreshAt < 1500) {
    return;
  }
  lastResumeRefreshAt = now;

  try {
    await refreshAll();
    await syncCurrentLocation({ quiet: true });
  } catch (error) {
    if (error.message !== "family code is required") {
      elements.connectionState.textContent = "刷新失败";
    }
  }
}

function renderPosts() {
  elements.feedTitle.textContent = FILTER_TITLES[state.filter];
  renderResourceArchiveTools();
  elements.feedList.replaceChildren();

  if (state.posts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = `这里还没有${state.filter === "all" ? "" : KIND_TITLES[state.filter]}内容`;
    elements.feedList.append(empty);
    return;
  }

  for (const post of state.posts) {
    elements.feedList.append(renderPost(post));
  }
}

function renderPost(post) {
  const fragment = elements.postTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".post-card");
  const toggle = fragment.querySelector(".todo-toggle");
  const image = fragment.querySelector(".post-image");
  const title = fragment.querySelector("h3");

  card.classList.toggle("completed", post.todoStatus === "completed");
  card.classList.toggle("is-pinned", Boolean(post.pinnedAt));
  fragment.querySelector(".post-kind").textContent = KIND_TITLES[post.kind] || post.kind;
  fragment.querySelector(".post-author").textContent = `· ${post.authorName}`;
  fragment.querySelector(".post-time").textContent = formatTime(post.createdAt);
  title.textContent = post.title;
  fragment.querySelector(".post-body").textContent = post.body;
  const postTags = renderPostTags(post);
  if (postTags) {
    fragment.querySelector(".post-body").after(postTags);
  }

  if (shouldShowNewBadge(post)) {
    const newBadge = document.createElement("span");
    newBadge.className = "post-new-badge";
    newBadge.textContent = "NEW";
    newBadge.setAttribute("aria-label", "最新消息");
    title.after(newBadge);
    card.classList.add("is-new");
    watchNewPostCard(card, post);
  }

  if (post.kind === "todo") {
    toggle.textContent = post.todoStatus === "completed" ? "已完成" : "未完成";
    toggle.addEventListener("click", () => toggleTodo(post.id));
  } else {
    toggle.remove();
  }

  if (post.imageUrl) {
    image.src = post.imageUrl;
  } else {
    image.removeAttribute("src");
  }

  if (post.kind === "message") {
    const commentsSection = renderComments(post);
    card.append(commentsSection);
    collapseMessageReplyControls(card, commentsSection);
  }

  attachPostActionMenu(card, post);

  return fragment;
}

function renderPostTags(post) {
  if (!RESOURCE_KINDS.has(post.kind) || !Array.isArray(post.tagIds) || post.tagIds.length === 0) {
    return null;
  }

  const tagById = new Map(state.tags.map((tag) => [tag.id, tag]));
  const tags = post.tagIds.map((tagId) => tagById.get(tagId)).filter(Boolean);
  if (tags.length === 0) {
    return null;
  }

  const list = document.createElement("div");
  list.className = "post-tags";
  for (const tag of tags) {
    const chip = document.createElement("span");
    chip.className = "post-tag";
    chip.textContent = tag.name;
    list.append(chip);
  }
  return list;
}

function attachPostActionMenu(card, post) {
  wrapPostCardContent(card);

  const actions = document.createElement("div");
  actions.className = "post-actions";
  actions.hidden = true;

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "edit-action";
  editButton.textContent = "✏️";
  editButton.title = "编辑";
  editButton.setAttribute("aria-label", "编辑");
  editButton.addEventListener("click", (event) => {
    event.stopPropagation();
    editPost(post);
  });

  const pinButton = document.createElement("button");
  pinButton.type = "button";
  pinButton.className = "pin-action";
  pinButton.textContent = "📌";
  pinButton.title = post.pinnedAt ? "取消置顶" : "置顶";
  pinButton.setAttribute("aria-label", post.pinnedAt ? "取消置顶" : "置顶");
  pinButton.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePinPost(post);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-action";
  deleteButton.textContent = "🗑";
  deleteButton.title = "删除";
  deleteButton.setAttribute("aria-label", "删除");
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deletePost(post);
  });

  actions.append(editButton, pinButton, deleteButton);
  card.append(actions);

  let startX = 0;
  let startY = 0;
  let trackingSwipe = false;

  card.addEventListener("pointerdown", (event) => {
    if (isPostActionTarget(event.target) || event.button !== 0) {
      return;
    }

    startX = event.clientX;
    startY = event.clientY;
    trackingSwipe = true;
  });

  card.addEventListener("pointermove", (event) => {
    if (!trackingSwipe) {
      return;
    }

    const deltaX = startX - event.clientX;
    const deltaY = Math.abs(event.clientY - startY);
    if (Math.abs(deltaX) <= deltaY) {
      return;
    }

    if (startX - event.clientX >= POST_ACTION_SWIPE_THRESHOLD) {
      event.preventDefault();
      suppressPostActionSwipeClick();
      showPostActionMenu(card);
      trackingSwipe = false;
      return;
    }

    if (deltaX <= -POST_ACTION_SWIPE_THRESHOLD) {
      suppressPostActionSwipeClick();
      hidePostActionMenu(card);
      trackingSwipe = false;
    }
  });

  card.addEventListener("pointerup", () => {
    trackingSwipe = false;
  });
  card.addEventListener("pointercancel", () => {
    trackingSwipe = false;
  });
  card.addEventListener("pointerleave", () => {
    trackingSwipe = false;
  });
}

function wrapPostCardContent(card) {
  if (card.firstElementChild?.classList.contains("post-card-content")) {
    return;
  }

  const content = document.createElement("div");
  content.className = "post-card-content";
  while (card.firstChild) {
    content.append(card.firstChild);
  }
  card.append(content);
}

function showPostActionMenu(card) {
  if (activePostActionCard && activePostActionCard !== card) {
    hidePostActionMenu(activePostActionCard);
  }

  activePostActionCard = card;
  card.classList.add("action-menu-open");
  card.querySelector(".post-actions").hidden = false;
}

function hidePostActionMenu(card) {
  card.classList.remove("action-menu-open");
  card.querySelector(".post-actions").hidden = true;
  if (activePostActionCard === card) {
    activePostActionCard = null;
  }
}

function hideActivePostActionMenu() {
  if (activePostActionCard) {
    hidePostActionMenu(activePostActionCard);
  }
}

function suppressPostActionSwipeClick() {
  postActionClickSuppressUntil = Date.now() + POST_ACTION_CLICK_SUPPRESS_MS;
}

function closePostActionMenuFromAnyClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  if (isPostActionControlTarget(event.target)) {
    return;
  }

  if (Date.now() < postActionClickSuppressUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (!activePostActionCard) {
    return;
  }

  hideActivePostActionMenu();
  event.preventDefault();
  event.stopImmediatePropagation();
}

function isPostActionControlTarget(target) {
  return target instanceof Element && Boolean(target.closest(".post-actions"));
}

function isPostActionTarget(target) {
  return target instanceof Element && Boolean(target.closest(".post-actions, button, input, textarea, label"));
}

function editPost(post) {
  hideActivePostActionMenu();
  openComposer(post.kind, post);
}

async function togglePinPost(post) {
  hideActivePostActionMenu();
  await api(`/api/posts/${encodeURIComponent(post.id)}/pin`, {
    method: "PATCH",
    body: { actorMemberId: state.memberId }
  });
  await loadPosts();
  await loadFilterBadges();
}

async function deletePost(post) {
  if (!window.confirm("删除这条内容吗？")) {
    return;
  }

  hideActivePostActionMenu();
  await api(`/api/posts/${encodeURIComponent(post.id)}`, {
    method: "DELETE",
    body: { actorMemberId: state.memberId }
  });
  await loadPosts();
  await loadFilterBadges();
}

function shouldShowNewBadge(post) {
  const activity = latestPostActivity(post);
  if (!post.id || !activity.at) {
    return false;
  }
  if (activity.byMemberId && activity.byMemberId === state.memberId) {
    return false;
  }

  const readAt = postReadState[post.id];
  return !readAt || new Date(readAt).getTime() < new Date(activity.at).getTime();
}

function latestPostActivity(post) {
  const commentActivity = latestCommentActivity(post);
  if (commentActivity && new Date(commentActivity.at) > new Date(post.activityAt || post.createdAt || 0)) {
    return commentActivity;
  }

  return {
    at: post.activityAt || "",
    byMemberId: post.activityByMemberId || "",
    type: post.activityType || ""
  };
}

function latestCommentActivity(post) {
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const latestComment = comments
    .filter((comment) => comment.createdAt)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];

  if (!latestComment) {
    return null;
  }

  return {
    at: latestComment.createdAt,
    byMemberId: latestComment.authorMemberId || "",
    type: "comment-added"
  };
}

function watchNewPostCard(card, post) {
  let timer = null;
  const markSeen = () => {
    if (timer) {
      return;
    }

    timer = window.setTimeout(() => {
      markPostActivityRead(post);
      card.classList.remove("is-new");
      card.querySelector(".post-new-badge")?.remove();
    }, NEW_BADGE_VISIBLE_MS);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
          observer.disconnect();
          markSeen();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(card);
    return;
  }

  markSeen();
}

function markPostActivityRead(post) {
  const activity = latestPostActivity(post);
  if (!post.id || !activity.at) {
    return;
  }

  postReadState = {
    ...postReadState,
    [post.id]: activity.at
  };
  localStorage.setItem(POST_READ_STATE_KEY, JSON.stringify(postReadState));
  renderFilterBadges();
}

function loadPostReadState() {
  try {
    return JSON.parse(localStorage.getItem(POST_READ_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function renderComments(post) {
  const commentsSection = document.createElement("section");
  commentsSection.className = "comments-section";

  const comments = Array.isArray(post.comments) ? post.comments : [];
  if (comments.length > 0) {
    commentsSection.classList.add("has-comments");
    const list = document.createElement("div");
    list.className = "comments-list";
    for (const comment of comments) {
      const item = document.createElement("div");
      item.className = "comment-item";

      const author = document.createElement("strong");
      author.textContent = comment.authorName;

      const content = document.createElement("div");
      content.className = "comment-content";

      const body = document.createElement("span");
      body.textContent = comment.body || (comment.imageUrl ? "发来一张照片" : "");
      content.append(body);

      if (comment.imageUrl) {
        const photoButton = document.createElement("button");
        photoButton.type = "button";
        photoButton.className = "comment-photo-button";
        photoButton.setAttribute("aria-label", "查看回复照片");
        photoButton.addEventListener("click", () => openImagePreview(comment.imageUrl));

        const thumbnail = document.createElement("img");
        thumbnail.src = comment.imageUrl;
        thumbnail.alt = "回复照片缩略图";
        photoButton.append(thumbnail);
        content.append(photoButton);
      }

      const time = document.createElement("time");
      time.textContent = formatTime(comment.createdAt);

      item.append(author, content, time);
      list.append(item);
    }
    commentsSection.append(list);
  }

  const form = document.createElement("form");
  form.className = "comment-form";

  const textarea = document.createElement("textarea");
  textarea.maxLength = 120;
  textarea.rows = 1;
  textarea.placeholder = "回复一句";

  const emojiRow = document.createElement("div");
  emojiRow.className = "emoji-row";
  for (const emoji of COMMENT_EMOJIS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.setAttribute("aria-label", `添加${emoji}`);
    button.addEventListener("click", () => appendEmoji(textarea, emoji));
    emojiRow.append(button);
  }

  const photoInput = document.createElement("input");
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.className = "comment-photo-input";
  photoInput.addEventListener("click", markCommentPhotoPickerOpened);

  let selectedPhotoUrl = "";
  const selectedPhoto = document.createElement("button");
  selectedPhoto.type = "button";
  selectedPhoto.className = "comment-photo-preview";
  selectedPhoto.hidden = true;
  selectedPhoto.setAttribute("aria-label", "查看已选回复照片");
  const selectedPhotoImage = document.createElement("img");
  selectedPhotoImage.alt = "已选回复照片";
  selectedPhoto.append(selectedPhotoImage);
  selectedPhoto.addEventListener("click", () => {
    if (selectedPhotoUrl) {
      openImagePreview(selectedPhotoUrl);
    }
  });

  const feedback = document.createElement("p");
  feedback.className = "comment-form-feedback";
  feedback.hidden = true;

  const photoField = document.createElement("label");
  photoField.className = "comment-photo-field";
  photoField.setAttribute("aria-label", "添加回复照片");
  photoField.title = "添加回复照片";
  const photoIcon = document.createElement("span");
  photoIcon.textContent = "📷";
  photoField.append(photoIcon, photoInput);

  const refreshSelectedPhoto = () => {
    if (!form.isConnected) {
      commentPhotoRefreshers.delete(refreshSelectedPhoto);
      return false;
    }

    updateSelectedCommentPhoto({
      feedback,
      photoField,
      photoInput,
      selectedPhoto,
      selectedPhotoImage,
      selectedPhotoUrl,
      submitButton,
      setSelectedPhotoUrl: (url) => {
        selectedPhotoUrl = url;
      }
    });
    return Boolean(photoInput.files[0]);
  };
  const refreshSelectedPhotoSoon = () => {
    window.setTimeout(refreshSelectedPhoto, 0);
    window.setTimeout(refreshSelectedPhoto, 250);
  };
  commentPhotoRefreshers.add(refreshSelectedPhoto);
  photoInput.addEventListener("input", refreshSelectedPhotoSoon);
  photoInput.addEventListener("change", refreshSelectedPhotoSoon);

  const tools = document.createElement("div");
  tools.className = "comment-tools";
  tools.append(emojiRow, photoField);

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "回复";

  form.append(textarea, submitButton, tools, selectedPhoto, feedback);
  form.addEventListener("submit", (event) => submitComment(event, post.id, textarea, photoInput, feedback, submitButton));
  commentsSection.append(form);

  return commentsSection;
}

function collapseMessageReplyControls(card, commentsSection) {
  const form = commentsSection.querySelector(".comment-form");
  if (!form) {
    return;
  }

  card.classList.add("message-card");
  card.setAttribute("tabindex", "0");
  hideMessageReplyControls(card, commentsSection);

  card.addEventListener("click", (event) => {
    if (isMessageReplyControlTarget(event.target)) {
      return;
    }
    toggleMessageReplyControls(card, commentsSection);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    if (isMessageReplyControlTarget(event.target)) {
      return;
    }
    event.preventDefault();
    toggleMessageReplyControls(card, commentsSection);
  });
}

function toggleMessageReplyControls(card, commentsSection) {
  if (commentsSection.classList.contains("reply-collapsed")) {
    expandMessageReplyControls(card, commentsSection);
    return;
  }

  hideMessageReplyControls(card, commentsSection);
}

function hideMessageReplyControls(card, commentsSection) {
  const form = commentsSection.querySelector(".comment-form");
  if (!form) {
    return;
  }

  commentsSection.classList.add("reply-collapsed");
  form.setAttribute("aria-hidden", "true");
  card.setAttribute("aria-expanded", "false");
}

function expandMessageReplyControls(card, commentsSection) {
  const form = commentsSection.querySelector(".comment-form");
  if (!form) {
    return;
  }

  commentsSection.classList.remove("reply-collapsed");
  form.removeAttribute("aria-hidden");
  card.setAttribute("aria-expanded", "true");
}

function isMessageReplyControlTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest("button, input, textarea, label, .comment-form, .comment-photo-button, .image-preview-overlay"));
}

function refreshCommentPhotoSelections() {
  for (const refresh of [...commentPhotoRefreshers]) {
    refresh();
  }
}

function hasPendingCommentPhotoSelection() {
  return [...commentPhotoRefreshers].some((refresh) => refresh());
}

function markCommentPhotoPickerOpened() {
  commentPhotoPickerOpenedAt = Date.now();
  window.clearTimeout(commentPhotoPickerClearTimer);
}

function isCommentPhotoPickerReturning() {
  if (!commentPhotoPickerOpenedAt) {
    return false;
  }

  if (Date.now() - commentPhotoPickerOpenedAt > COMMENT_PHOTO_PICKER_RETURN_WINDOW_MS) {
    commentPhotoPickerOpenedAt = 0;
    return false;
  }

  return true;
}

function settleCommentPhotoPickerReturn() {
  if (!commentPhotoPickerOpenedAt) {
    return;
  }

  window.clearTimeout(commentPhotoPickerClearTimer);
  commentPhotoPickerClearTimer = window.setTimeout(() => {
    commentPhotoPickerOpenedAt = 0;
  }, COMMENT_PHOTO_PICKER_SETTLE_MS);
}

function updateSelectedCommentPhoto({
  feedback,
  photoField,
  photoInput,
  selectedPhoto,
  selectedPhotoImage,
  selectedPhotoUrl,
  submitButton,
  setSelectedPhotoUrl
}) {
  if (selectedPhotoUrl) {
    URL.revokeObjectURL(selectedPhotoUrl);
    setSelectedPhotoUrl("");
  }

  const file = photoInput.files[0];
  const hasPhoto = Boolean(file);
  photoField.classList.toggle("has-photo", hasPhoto);
  photoField.setAttribute("aria-label", hasPhoto ? "已选择回复照片" : "添加回复照片");
  photoField.title = hasPhoto ? "已选择回复照片" : "添加回复照片";
  submitButton.textContent = hasPhoto ? "发送照片" : "回复";

  if (!hasPhoto) {
    selectedPhoto.hidden = true;
    selectedPhotoImage.removeAttribute("src");
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("is-error");
    return;
  }

  const url = URL.createObjectURL(file);
  setSelectedPhotoUrl(url);
  selectedPhotoImage.src = url;
  selectedPhoto.hidden = false;
  feedback.textContent = "已选照片，点回复发送";
  feedback.classList.remove("is-error");
  feedback.hidden = false;
}

function appendEmoji(textarea, emoji) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${emoji}${textarea.value.slice(end)}`;
  const cursor = start + emoji.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.focus();
}

function openImagePreview(imageUrl) {
  const overlay = document.createElement("div");
  overlay.className = "image-preview-overlay";

  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = "回复照片大图";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "image-preview-close";
  closeButton.setAttribute("aria-label", "关闭照片预览");
  closeButton.textContent = "×";

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", handleKeydown);
  };
  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      close();
    }
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  closeButton.addEventListener("click", close);
  document.addEventListener("keydown", handleKeydown);

  overlay.append(closeButton, image);
  document.body.append(overlay);
  closeButton.focus();
}

async function submitComment(event, postId, textarea, photoInput, feedback, submitButton) {
  event.preventDefault();
  if (!ensureDisplayName()) {
    return;
  }

  const body = textarea.value.trim();
  const file = photoInput.files[0];
  if (!body && !file) {
    textarea.focus();
    return;
  }

  const idleText = file ? "发送照片" : "回复";
  submitButton.disabled = true;
  submitButton.textContent = file ? "处理中" : "发送中";
  feedback.textContent = file ? "照片处理中" : "发送中";
  feedback.classList.remove("is-error");
  feedback.hidden = false;

  try {
    const imageUrl = file ? await uploadImage(file) : null;

    await api(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      body: {
        body,
        imageUrl,
        authorName: state.displayName,
        authorMemberId: state.memberId
      }
    });
    textarea.value = "";
    photoInput.value = "";
    await loadPosts();
    await loadFilterBadges();
  } catch (error) {
    feedback.textContent = error.message || "照片发送失败";
    feedback.classList.add("is-error");
    feedback.hidden = false;
    submitButton.disabled = false;
    submitButton.textContent = idleText;
  }
}

async function toggleTodo(id) {
  await api(`/api/posts/${encodeURIComponent(id)}/toggle`, {
    method: "PATCH",
    body: { actorMemberId: state.memberId }
  });
  await loadPosts();
  await loadFilterBadges();
}

function updateFilterTabs() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

async function loadFilterBadges() {
  const [todoResult, resourceResult, messageResult] = await Promise.all([
    api("/api/posts?filter=todo"),
    api("/api/posts?filter=resource"),
    api("/api/posts?filter=message")
  ]);

  state.filterBadgePosts = {
    todo: todoResult.posts,
    resource: resourceResult.posts,
    message: messageResult.posts
  };
  renderFilterBadges();
}

function filterBadgeCounts() {
  return {
    todo: state.filterBadgePosts.todo.filter((post) => post.todoStatus === "incomplete").length,
    resource: unreadPostCount(state.filterBadgePosts.resource),
    message: unreadPostCount(state.filterBadgePosts.message)
  };
}

function unreadPostCount(posts) {
  return posts.filter((post) => shouldShowNewBadge(post)).length;
}

function renderFilterBadges() {
  const counts = filterBadgeCounts();
  document.querySelectorAll("[data-filter-badge]").forEach((badge) => {
    const kind = badge.dataset.filterBadge;
    const count = counts[kind] || 0;
    const button = badge.closest("button");
    const label = button?.querySelector(".filter-label")?.textContent || "";

    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
    button?.setAttribute("aria-label", count > 0 ? `${label}，${filterBadgeDescription(kind, count)}` : label);
  });
}

function filterBadgeDescription(kind, count) {
  if (kind === "todo") {
    return `${count} 个未完成待办`;
  }
  if (kind === "resource") {
    return `${count} 个未查看资料`;
  }
  return `${count} 个未查看留言`;
}

function saveDisplayName() {
  const displayName = elements.displayNameInput.value.trim();
  if (!displayName) {
    elements.displayNameInput.focus();
    return false;
  }

  state.displayName = displayName;
  localStorage.setItem("miemie.displayName", state.displayName);
  elements.displayNameInput.value = state.displayName;
  elements.identityPanel.hidden = true;
  return true;
}

function ensureDisplayName() {
  if (state.displayName) {
    return true;
  }

  elements.identityPanel.hidden = false;
  elements.displayNameInput.focus();
  return false;
}

async function saveFamilyCode() {
  state.familyCode = elements.familyCodeInput.value.trim();
  localStorage.setItem("miemie.familyCode", state.familyCode);
  elements.accessPanel.hidden = true;
  await refreshAll();
  connectEvents();
}

async function shareLocation() {
  if (!ensureDisplayName()) {
    return;
  }

  await syncCurrentLocation();
}

async function syncCurrentLocation({ quiet = false } = {}) {
  if (!state.displayName) {
    return false;
  }
  if (!("geolocation" in navigator)) {
    if (!quiet) {
      elements.statusText.textContent = "当前浏览器不支持定位";
    }
    return false;
  }

  if (!quiet) {
    elements.statusText.textContent = "正在同步位置";
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api(`/api/members/${encodeURIComponent(state.memberId)}/location`, {
            method: "POST",
            body: {
              displayName: state.displayName,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          });
          await loadStatus();
          resolve(true);
        } catch (error) {
          elements.statusText.textContent = quiet ? "自动定位失败，可点同步位置重试" : error.message || "位置同步失败";
          resolve(false);
        }
      },
      (error) => {
        const message = locationErrorText(error);
        elements.statusText.textContent = quiet ? `${message}，可点同步位置重试` : message;
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function locationErrorText(error) {
  if (error?.code === 1) {
    return "定位没有授权，距离暂时无法更新";
  }
  if (error?.code === 2) {
    return "暂时拿不到当前位置";
  }
  if (error?.code === 3) {
    return "定位超时，距离暂时无法更新";
  }
  return "位置同步失败";
}

async function loadStatus() {
  const status = await api("/api/status");
  elements.distanceText.textContent = formatDistance(status.distanceMeters);
  elements.statusText.textContent = emotionalStatusText(status);
  elements.syncDetailText.textContent = syncDetailText(status);
  elements.syncDetailText.hidden = !elements.syncDetailText.textContent;
}

function emotionalStatusText(status) {
  const members = locationMembers(status);
  const todayKey = new Date().toISOString().slice(0, 10);
  if (members.length === 0) {
    return pickStatusCopy("empty", todayKey);
  }
  if (members.length === 1) {
    return formatStatusCopy(pickStatusCopy("single", `${todayKey}:${members[0].id}`), {
      name: members[0].displayName
    });
  }

  const otherMember = members.find((member) => member.id !== state.memberId) || oldestLocationMember(members);
  const otherAgeSeconds = locationAgeSeconds(otherMember);
  const newestAgeSeconds = Math.min(...members.map(locationAgeSeconds));
  const allRecentlySynced = members.every((member) => locationAgeSeconds(member) < 30 * 60);
  const statusKey = statusCopyKey(status, members, todayKey);

  if (status.distanceMeters != null && status.distanceMeters < 1000 && allRecentlySynced) {
    return pickStatusCopy("close", statusKey);
  }
  if (members.every((member) => locationAgeSeconds(member) < 2 * 60)) {
    return pickStatusCopy("fresh", statusKey);
  }
  if (allRecentlySynced && status.distanceMeters != null && status.distanceMeters >= 10000) {
    return pickStatusCopy("far", statusKey);
  }
  if (otherAgeSeconds >= 5 * 60) {
    return formatStatusCopy(pickStatusCopy("stale", `${statusKey}:${otherMember.id}`), {
      name: otherMember.displayName || "对方",
      time: formatRelativeTime(otherMember.updatedAt)
    });
  }
  if (newestAgeSeconds < 5 * 60) {
    return pickStatusCopy("fresh", statusKey);
  }

  return pickStatusCopy("fallback", statusKey);
}

function syncDetailText(status) {
  const members = locationMembers(status);
  if (members.length === 0) {
    return "";
  }
  return members
    .map((member) => `${member.displayName} ${formatRelativeTime(member.updatedAt)}`)
    .join(" · ");
}

function locationMembers(status) {
  return status.members.filter((member) => member.updatedAt);
}

function oldestLocationMember(members) {
  return [...members].sort((left, right) => new Date(left.updatedAt) - new Date(right.updatedAt))[0];
}

function locationAgeSeconds(member) {
  return Math.max(0, Math.round((Date.now() - new Date(member.updatedAt).getTime()) / 1000));
}

function statusCopyKey(status, members, todayKey) {
  const distanceKey = status.distanceMeters == null ? "waiting" : Math.round(status.distanceMeters / 1000);
  const memberKey = members.map((member) => member.id || member.displayName).join("|");
  return `${todayKey}:${distanceKey}:${memberKey}`;
}

function pickStatusCopy(group, key) {
  const copy = EMOTIONAL_STATUS_COPY[group] || EMOTIONAL_STATUS_COPY.fallback;
  return copy[stableStatusCopyIndex(`${group}:${key}`, copy.length)];
}

function stableStatusCopyIndex(key, count) {
  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) % count;
  }
  return hash;
}

function formatStatusCopy(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);
}

function connectEvents() {
  if (!("EventSource" in window)) {
    elements.connectionState.textContent = "手动刷新";
    return;
  }

  const query = state.familyCode ? `?familyCode=${encodeURIComponent(state.familyCode)}` : "";
  eventSource?.close();
  eventSource = new EventSource(`/api/events${query}`);
  eventSource.addEventListener("open", () => {
    elements.connectionState.textContent = "实时同步";
  });
  eventSource.addEventListener("message", async (event) => {
    const familyEvent = JSON.parse(event.data);
    await refreshAll();
    notifyForEvent(familyEvent);
  });
  eventSource.addEventListener("error", () => {
    elements.connectionState.textContent = "重连中";
  });
}

async function requestNotificationPermission() {
  if (!ensureDisplayName()) {
    return;
  }

  if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
    elements.enableNotifyButton.textContent = "不支持通知";
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    elements.enableNotifyButton.textContent = "通知未开";
    return;
  }

  const key = await api("/api/push/public-key");
  if (!key.enabled) {
    elements.enableNotifyButton.textContent = "后台通知未配置";
    return;
  }

  const registration = serviceWorkerRegistration ?? (await navigator.serviceWorker.ready);
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key.publicKey)
    }));

  await api("/api/push/subscriptions", {
    method: "POST",
    body: {
      memberId: state.memberId,
      displayName: state.displayName,
      subscription: subscription.toJSON()
    }
  });

  await refreshNotificationButton();
}

async function refreshNotificationButton() {
  const supported = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
  if (!supported) {
    elements.enableNotifyButton.textContent = notificationButtonText({ supported: false });
    return;
  }

  let hasSubscription = false;
  try {
    const registration = serviceWorkerRegistration ?? (await navigator.serviceWorker.ready);
    hasSubscription = Boolean(await registration.pushManager.getSubscription());
  } catch {
    hasSubscription = false;
  }

  let pushConfigured = true;
  if (Notification.permission === "granted") {
    try {
      pushConfigured = (await api("/api/push/public-key")).enabled;
    } catch {
      pushConfigured = true;
    }
  }

  elements.enableNotifyButton.textContent = notificationButtonText({
    supported,
    permission: Notification.permission,
    hasSubscription,
    pushConfigured
  });
}

function notifyForEvent(event) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  if (
    event.post?.authorMemberId === state.memberId ||
    event.actorMemberId === state.memberId ||
    event.member?.id === state.memberId ||
    event.post?.authorName === state.displayName
  ) {
    return;
  }

  const message = notificationMessage(event);
  if (message) {
    new Notification(message.title, {
      body: message.body,
      icon: "/icons/app-icon.png"
    });
  }
}

function notificationMessage(event) {
  if (event.type === "post-added") {
    return {
      title: `miemie 有新${KIND_TITLES[event.post.kind] || "内容"}`,
      body: event.post.title
    };
  }
  if (event.type === "todo-status-updated") {
    return {
      title: "miemie 待办状态更新",
      body: `${event.post.title}：${event.post.todoStatus === "completed" ? "已完成" : "未完成"}`
    };
  }
  if (event.type === "post-updated") {
    return {
      title: `miemie ${KIND_TITLES[event.post.kind] || "内容"}已更新`,
      body: event.post.title
    };
  }
  if (event.type === "post-deleted") {
    return {
      title: `miemie ${KIND_TITLES[event.post.kind] || "内容"}已删除`,
      body: event.post.title
    };
  }
  if (event.type === "post-pinned") {
    return {
      title: `miemie ${KIND_TITLES[event.post.kind] || "内容"}已置顶`,
      body: event.post.title
    };
  }
  if (event.type === "post-unpinned") {
    return {
      title: `miemie ${KIND_TITLES[event.post.kind] || "内容"}已取消置顶`,
      body: event.post.title
    };
  }
  if (event.type === "comment-added") {
    return {
      title: "miemie 有新回复",
      body: commentNotificationBody(event.comment)
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

async function api(path, options = {}) {
  const headers = options.body ? { "content-type": "application/json" } : {};
  if (state.familyCode) {
    headers["x-miemie-family-code"] = state.familyCode;
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const body = await response.json();
  if (response.status === 401) {
    showAccessPanel();
    throw new Error("family code is required");
  }
  if (!response.ok) {
    throw new Error(body.error || "请求失败");
  }
  return body;
}

function showAccessPanel() {
  elements.accessPanel.hidden = false;
  elements.familyCodeInput.focus();
}

function formatDistance(meters) {
  if (meters == null) {
    return "等待同步";
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

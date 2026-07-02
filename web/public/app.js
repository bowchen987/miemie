import { notificationButtonText } from "./notificationUi.js";

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

const COMMENT_EMOJIS = ["❤️", "👍", "😂", "🥰", "👏", "🙏"];
const COMMENT_PHOTO_PICKER_RETURN_WINDOW_MS = 10 * 60 * 1000;
const COMMENT_PHOTO_PICKER_SETTLE_MS = 1500;
const NEW_BADGE_VISIBLE_MS = 1400;
const POST_READ_STATE_KEY = "miemie.postReadState";
const UPLOAD_IMAGE_MAX_EDGE = 1600;
const UPLOAD_IMAGE_QUALITY = 0.82;

const state = {
  filter: "all",
  composeKind: "message",
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
  photoInput: document.querySelector("#photoInput"),
  postBodyInput: document.querySelector("#postBodyInput"),
  postForm: document.querySelector("#postForm"),
  postTemplate: document.querySelector("#postTemplate"),
  postTitleInput: document.querySelector("#postTitleInput"),
  saveNameButton: document.querySelector("#saveNameButton"),
  saveFamilyCodeButton: document.querySelector("#saveFamilyCodeButton"),
  shareLocationButton: document.querySelector("#shareLocationButton"),
  statusText: document.querySelector("#statusText")
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
    await syncCurrentLocation({ quiet: true, requireOptIn: true });
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

  document.querySelector("#closeComposerButton").addEventListener("click", () => {
    elements.composer.hidden = true;
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      updateFilterTabs();
      loadPosts();
    });
  });

  elements.postForm.addEventListener("submit", submitPost);
  elements.saveNameButton.addEventListener("click", saveDisplayName);
  elements.saveFamilyCodeButton.addEventListener("click", saveFamilyCode);
  elements.shareLocationButton.addEventListener("click", shareLocation);
  elements.enableNotifyButton.addEventListener("click", requestNotificationPermission);
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

function openComposer(kind) {
  state.composeKind = kind;
  elements.composerTitle.textContent = `发布${KIND_TITLES[kind]}`;
  elements.postTitleInput.placeholder = placeholderForKind(kind);
  elements.postBodyInput.value = "";
  elements.postTitleInput.value = "";
  elements.photoInput.value = "";
  elements.composer.hidden = false;
  elements.postTitleInput.focus();
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

  await api("/api/posts", {
    method: "POST",
    body: {
      kind: state.composeKind,
      title,
      body,
      authorName: state.displayName,
      authorMemberId: state.memberId,
      hasPhoto: Boolean(imageUrl),
      imageUrl
    }
  });

  elements.composer.hidden = true;
  await loadPosts();
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

async function loadPosts() {
  const params = new URLSearchParams({ filter: state.filter });
  if (state.filter === "all") {
    for (const [key, value] of todayRangeParams()) {
      params.set(key, value);
    }
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
  await Promise.all([loadPosts(), loadStatus()]);
}

async function refreshAfterResume() {
  if (document.visibilityState === "hidden") {
    return;
  }

  if (hasPendingCommentPhotoSelection() || isCommentPhotoPickerReturning()) {
    refreshCommentPhotoSelections();
    settleCommentPhotoPickerReturn();
    await syncCurrentLocation({ quiet: true, requireOptIn: true });
    return;
  }

  const now = Date.now();
  if (now - lastResumeRefreshAt < 1500) {
    return;
  }
  lastResumeRefreshAt = now;

  try {
    await refreshAll();
    await syncCurrentLocation({ quiet: true, requireOptIn: true });
  } catch (error) {
    if (error.message !== "family code is required") {
      elements.connectionState.textContent = "刷新失败";
    }
  }
}

function renderPosts() {
  elements.feedTitle.textContent = FILTER_TITLES[state.filter];
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
  fragment.querySelector(".post-kind").textContent = KIND_TITLES[post.kind] || post.kind;
  fragment.querySelector(".post-author").textContent = `· ${post.authorName}`;
  fragment.querySelector(".post-time").textContent = formatTime(post.createdAt);
  title.textContent = post.title;
  fragment.querySelector(".post-body").textContent = post.body;

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
    card.append(renderComments(post));
  }

  return fragment;
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
  return {
    at: post.activityAt || "",
    byMemberId: post.activityByMemberId || "",
    type: post.activityType || ""
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
}

function loadPostReadState() {
  try {
    return JSON.parse(localStorage.getItem(POST_READ_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function renderComments(post) {
  const section = document.createElement("section");
  section.className = "comments-section";

  const comments = Array.isArray(post.comments) ? post.comments : [];
  if (comments.length > 0) {
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
    section.append(list);
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
  section.append(form);

  return section;
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
}

function updateFilterTabs() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
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

async function syncCurrentLocation({ quiet = false, requireOptIn = false } = {}) {
  if (requireOptIn && localStorage.getItem("miemie.locationAutoSyncEnabled") !== "true") {
    return false;
  }
  if (!state.displayName) {
    return false;
  }
  if (!("geolocation" in navigator)) {
    if (!quiet) {
      elements.statusText.textContent = "当前浏览器不支持定位";
    }
    return false;
  }
  if (requireOptIn && !(await canAutoSyncLocation())) {
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
          localStorage.setItem("miemie.locationAutoSyncEnabled", "true");
          await loadStatus();
          resolve(true);
        } catch (error) {
          if (!quiet) {
            elements.statusText.textContent = error.message || "位置同步失败";
          }
          resolve(false);
        }
      },
      () => {
        if (!quiet) {
          elements.statusText.textContent = "定位没有授权，距离暂时无法更新";
        }
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

async function canAutoSyncLocation() {
  if (!("permissions" in navigator)) {
    return true;
  }

  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    return permission.state === "granted";
  } catch {
    return true;
  }
}

async function loadStatus() {
  const status = await api("/api/status");
  elements.distanceText.textContent = formatDistance(status.distanceMeters);
  elements.statusText.textContent = statusText(status);
}

function statusText(status) {
  if (status.members.length === 0) {
    return "点击同步位置，把当前位置发给对方";
  }
  if (status.members.length === 1) {
    return `${status.members[0].displayName} 已同步，等待另一位`;
  }

  return status.members
    .map((member) => `${member.displayName} ${formatRelativeTime(member.updatedAt)}`)
    .join(" · ");
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

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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

function formatRelativeTime(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) {
    return "刚刚";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  return formatTime(value);
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

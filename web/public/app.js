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
  try {
    await Promise.all([loadPosts(), loadStatus()]);
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
  const dataUrl = await readFileAsDataUrl(file);
  const result = await api("/api/uploads", {
    method: "POST",
    body: {
      fileName: file.name,
      dataUrl
    }
  });
  return result.url;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

async function loadPosts() {
  const result = await api(`/api/posts?filter=${encodeURIComponent(state.filter)}`);
  state.posts = result.posts;
  renderPosts();
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

  card.classList.toggle("completed", post.todoStatus === "completed");
  fragment.querySelector(".post-kind").textContent = KIND_TITLES[post.kind] || post.kind;
  fragment.querySelector(".post-author").textContent = `· ${post.authorName}`;
  fragment.querySelector(".post-time").textContent = formatTime(post.createdAt);
  fragment.querySelector("h3").textContent = post.title;
  fragment.querySelector(".post-body").textContent = post.body;

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

  return fragment;
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
  await Promise.all([loadPosts(), loadStatus()]);
  connectEvents();
}

async function shareLocation() {
  if (!ensureDisplayName()) {
    return;
  }

  if (!("geolocation" in navigator)) {
    elements.statusText.textContent = "当前浏览器不支持定位";
    return;
  }

  elements.statusText.textContent = "正在同步位置";
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      await api(`/api/members/${encodeURIComponent(state.memberId)}/location`, {
        method: "POST",
        body: {
          displayName: state.displayName,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      });
      await loadStatus();
    },
    () => {
      elements.statusText.textContent = "定位没有授权，距离暂时无法更新";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
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
    await Promise.all([loadPosts(), loadStatus()]);
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

  elements.enableNotifyButton.textContent = "后台通知已开";
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
  if (event.type === "member-location-updated") {
    return {
      title: "miemie 距离更新",
      body: `${event.member.displayName} 刚刚同步了位置`
    };
  }
  return null;
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

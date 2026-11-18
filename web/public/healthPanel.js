const DAY_MS = 86_400_000;
const nameKey = value => value.trim().normalize("NFKC").toLocaleLowerCase();

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, action) {
  const node = element("button", text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function swatch(activity) {
  const dot = element("i");
  dot.className = "health-swatch";
  dot.style.backgroundColor = activity.color;
  return dot;
}

export function setupHealthPanel({ api, ensureDisplayName, currentName }) {
  const get = id => document.getElementById(id);
  const home = get("homePage");
  const page = get("healthPage");
  if (!page || !home) return;
  const manager = get("healthManager");
  const notice = get("healthNotice");
  const draft = new Map();
  const expandedGuides = new Set();
  let view, member, date, scrollY, timer, busy = false, revision = 0;
  const mine = () => nameKey(member) === nameKey(currentName());
  const today = () => view.days[6].date;
  const canLeave = () => !busy && (!draft.size || window.confirm("放弃尚未保存的打卡修改？"));

  function open() {
    if (!page.hidden) return;
    scrollY = window.scrollY;
    home.hidden = true;
    page.hidden = false;
    member = currentName();
    date = null;
    view = null;
    draft.clear();
    expandedGuides.clear();
    get("healthContent").hidden = true;
    get("healthMembers").replaceChildren();
    get("healthRetry").hidden = true;
    notice.textContent = "正在加载打卡记录…";
    page.querySelector("h1").focus({ preventScroll: true });
    window.scrollTo(0, 0);
    refresh();
  }

  function close() {
    ++revision;
    clearTimeout(timer);
    manager.close();
    page.hidden = true;
    home.hidden = false;
    draft.clear();
    get("openHealth").focus({ preventScroll: true });
    window.scrollTo(0, scrollY);
  }

  function route() {
    if (location.hash === "#health") {
      if (ensureDisplayName()) open();
      else history.replaceState(null, "", location.pathname + location.search);
    } else if (!page.hidden) {
      if (canLeave()) close();
      else history.pushState({ health: true }, "", "#health");
    }
  }
  get("openHealth").onclick = () => {
    if (!ensureDisplayName()) return;
    history.pushState({ health: true }, "", "#health");
    open();
  };
  get("healthBack").onclick = () => {
    if (history.state?.health) history.back();
    else if (canLeave()) {
      history.replaceState(null, "", location.pathname + location.search);
      close();
    }
  };
  window.addEventListener("popstate", route);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  get("healthRetry").onclick = refresh;

  async function refresh() {
    if (page.hidden) return;
    const ticket = ++revision;
    try {
      const data = await api("/api/health/checkins?member=" + encodeURIComponent(member));
      if (ticket !== revision) return;
      const previouslyToday = view && date === today();
      const day = data.days.find(day => day.date === date);
      const expiredDraft = !day && draft.size > 0;
      if (!day || (previouslyToday && !draft.size)) date = data.days[6].date;
      if (!day) draft.clear();
      for (const id of draft.keys()) {
        if (!data.activities.some(a => a.id === id && a.active)) draft.delete(id);
      }
      view = data;
      if (expiredDraft) notice.textContent = "原日期已超出七天，已切换到今天";
      else if (!get("healthRetry").hidden || notice.textContent === "正在加载打卡记录…") notice.textContent = "";
      get("healthRetry").hidden = true;
      render();
    } catch (error) {
      if (ticket !== revision) return;
      if (error.message === "family code is required") {
        history.replaceState(null, "", location.pathname + location.search);
        close();
        get("familyCodeInput").focus();
        return;
      }
      notice.textContent = error.message;
      get("healthRetry").hidden = false;
    } finally {
      if (ticket === revision && !page.hidden) {
        clearTimeout(timer);
        const untilMidnight = DAY_MS - ((Date.now() + 8 * 3_600_000) % DAY_MS);
        timer = setTimeout(refresh, Math.min(untilMidnight + 100, get("healthRetry").hidden ? DAY_MS : 60_000));
      }
    }
  }

  function render() {
    const selected = view.days.find(day => day.date === date);
    get("healthContent").hidden = false;
    const members = new Map([currentName(), ...view.members].map(n => [nameKey(n), n]));
    get("healthMembers").replaceChildren(...Array.from(members, ([key, name]) => {
      const tab = button(key === nameKey(currentName()) ? "我" : name, () => {
        if (key === nameKey(member) || !canLeave()) return;
        member = name;
        draft.clear();
        view = null;
        get("healthContent").hidden = true;
        notice.textContent = "正在加载打卡记录…";
        refresh();
      });
      tab.setAttribute("aria-pressed", String(key === nameKey(member)));
      return tab;
    }));
    get("healthDate").textContent = date.replace(/-/g, ".") + (date === today() ? " · 今天" : "");
    get("healthScore").textContent = selected.score;
    const maxScore = Math.max(3, ...view.days.map(day => day.score));
    const chart = get("healthChart");
    chart.replaceChildren(...view.days.map(day => {
      const bar = button("", () => {
        if (date === day.date || !canLeave()) return;
        draft.clear();
        date = day.date;
        notice.textContent = "";
        render();
      });
      bar.setAttribute("aria-label", day.date + "，" + day.score + " 分");
      bar.setAttribute("aria-pressed", String(day.date === date));
      const track = element("span");
      track.className = "health-track";
      track.append(element("b", day.score));
      const stack = element("span");
      stack.className = "health-stack";
      stack.style.height = (day.score ? 80 * day.score / maxScore : 2) + "px";
      for (const activity of view.activities) {
        if (day.ids.includes(activity.id)) stack.append(swatch(activity));
      }
      track.append(stack);
      bar.append(track, element("small", day.date === today() ? "今天" : day.date.slice(5).replace("-", "/")));
      return bar;
    }));
    get("healthListTitle").textContent = mine() ? "打卡清单" : member + "的打卡";
    get("healthChecks").replaceChildren(...view.activities.filter(a => a.active || selected.ids.includes(a.id)).map(a => {
      const row = element("div");
      row.className = "health-check";
      const label = element("label");
      label.htmlFor = "health-check-" + a.id;
      label.append(swatch(a), element("span", a.name));
      row.append(label);
      const saved = selected.ids.includes(a.id);
      const input = element("input");
      input.type = "checkbox";
      input.id = label.htmlFor;
      input.checked = draft.get(a.id) ?? saved;
      input.disabled = busy || !mine() || !a.active;
      input.onchange = () => {
        if (input.checked === saved) draft.delete(a.id);
        else draft.set(a.id, input.checked);
        notice.textContent = "";
        get("healthSave").disabled = !draft.size;
      };
      row.append(element("small", a.active ? "1 分" : "已停用"), input);
      if (a.description) {
        const guide = element("p", a.description);
        guide.id = "health-guide-" + a.id;
        guide.hidden = !expandedGuides.has(a.id);
        const help = button("?", () => {
          guide.hidden = !guide.hidden;
          if (guide.hidden) expandedGuides.delete(a.id);
          else expandedGuides.add(a.id);
          help.setAttribute("aria-expanded", String(!guide.hidden));
        });
        help.className = "health-help";
        help.setAttribute("aria-label", a.name + "的打卡条件");
        help.setAttribute("aria-controls", guide.id);
        help.setAttribute("aria-expanded", String(!guide.hidden));
        label.after(help);
        row.append(guide);
      }
      return row;
    }));
    get("healthSave").hidden = !mine();
    get("healthSave").disabled = busy || !draft.size;
    get("healthSave").textContent = busy ? "保存中…" : "保存打卡";
    if (manager.open) renderManager();
  }

  get("healthSave").onclick = async () => {
    if (busy || !mine() || !draft.size) return;
    busy = true;
    const changes = Array.from(draft, ([id, done]) => ({ id, done }));
    const savedDate = date;
    render();
    try {
      const result = await api("/api/health/checkins", {
        method: "PATCH", body: { displayName: currentName(), date: savedDate, changes }
      });
      ++revision;
      const day = view.days.find(d => d.date === result.date);
      if (day) Object.assign(day, result);
      draft.clear();
      notice.textContent = "打卡已保存";
      await refresh();
    } catch (error) {
      notice.textContent = error.message;
    } finally {
      busy = false;
      if (!page.hidden && view) render();
    }
  };

  function renderManager() {
    get("healthManageList").replaceChildren(...view.activities.filter(a => a.active).map(a => {
      const row = element("div");
      const rename = button("改名", () => {
        const name = window.prompt("修改事项名称", a.name)?.trim();
        if (name && name !== a.name) editActivity(a.id, { name });
      });
      const retire = button("停用", () => {
        if (window.confirm("停用「" + a.name + "」？之前的打卡会保留。")) editActivity(a.id, { active: false });
      });
      row.append(swatch(a), element("span", a.name), rename, retire);
      return row;
    }));
  }

  async function editActivity(id, input) {
    if (manager.dataset.saving) return;
    manager.dataset.saving = "true";
    const status = get("healthManageNotice");
    status.textContent = "正在保存…";
    try {
      await api("/api/health/activities" + (id ? "/" + id : ""), { method: id ? "PATCH" : "POST", body: input });
      if (!id) get("healthAdd").reset();
      status.textContent = "已保存";
      await refresh();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      delete manager.dataset.saving;
    }
  }
  get("healthManage").onclick = () => {
    renderManager();
    get("healthManageNotice").textContent = "";
    manager.showModal();
  };
  get("healthManageClose").onclick = () => manager.close();
  get("healthAdd").onsubmit = event => {
    event.preventDefault();
    editActivity(null, { name: new FormData(event.target).get("name") });
  };
  route();
  return { refresh };
}

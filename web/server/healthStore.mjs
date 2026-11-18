import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { memberNameKey } from "./familyStore.mjs";

const DAY = 86_400_000;
const BEIJING_OFFSET = 8 * 3_600_000;
const colors = ["#dc9276", "#56ad91", "#9392c9", "#e2b254", "#6eaac6", "#d886aa",
  "#809d60", "#ca755b", "#598b96", "#b49a68", "#ae78a1"];
const sleepName = "昨天23:30前睡觉";
const sleepGuide = "所选日期的前一晚在 23:30 前睡觉就可以勾选。比如周二晚上早睡，就记在周三。";
const defaultActivities = [
  ["bowel", "顺畅便便", "今天排过一次便，就可以勾选。"],
  ["exercise", "健身", "今天完成了一次自己安排的锻炼。"],
  ["sleep", sleepName, sleepGuide],
  ["after-meal-walk", "饭后溜达", "选一顿饭，吃完出门走 10 分钟，接娃、遛弯都算。"],
  ["sitting-break", "屁股放个假", "今天有一次久坐时，主动站起来活动 5 分钟。"],
  ["vegetables", "蔬菜有戏", "午饭或晚饭里，认真吃了一份蔬菜。"],
  ["stretch", "肩膀下班", "收工后放一首歌，跟着舒舒服服伸展到歌结束。"],
  ["phone-bedtime", "手机先睡", "睡前把手机放到伸手够不到的地方，直到第二天起床。"],
  ["drink-swap", "今天几分甜", "今天有一次想点含糖饮料，最后选了白水或无糖茶。"],
  ["family-outdoors", "全家放风", "和家人一起去户外待 15 分钟，陪孩子在楼下玩也算。"],
  ["mood-chat", "心情开个麦", "和另一半聊一件今天开心或烦心的小事，认真听对方说完。"]
];

function activityColor(index) {
  return colors[index] ?? `hsl(${(index * 137.508) % 360} 45% 59%)`;
}

function weekEnding(now) {
  const local = now.getTime() + BEIJING_OFFSET;
  return Array.from({ length: 7 }, (_, i) => new Date(local - (6 - i) * DAY).toISOString().slice(0, 10));
}

function nameOf(value, limit) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit) {
    throw new Error(`名称需为 1 至 ${limit} 个字符`);
  }
  return value.trim();
}

function addDefaultActivities(data) {
  for (const [id, name, description] of defaultActivities) {
    const matchesName = a => memberNameKey(a.name) === memberNameKey(name);
    const existing = data.activities.find(a => a.id === id)
      ?? data.activities.find(a => a.active && matchesName(a))
      ?? data.activities.find(matchesName);
    if (existing) {
      if (matchesName(existing)) existing.description ??= description;
    } else {
      data.activities.push({ id, name, description, color: activityColor(data.activities.length), active: true });
    }
  }
}

function upgradeCatalog(data) {
  if (data.catalogVersion >= 3) return data;
  const oldName = "23:30 前睡觉";
  const sleep = data.activities.find(a => a.id === "sleep")
    ?? data.activities.find(a => a.name === oldName);
  if (sleep && (sleep.name === oldName || sleep.name === sleepName)) {
    sleep.name = sleepName;
    sleep.description = sleepGuide;
  }
  if ((data.catalogVersion ?? 0) < 2) addDefaultActivities(data);
  data.catalogVersion = 3;
  return data;
}

export class HealthStore {
  constructor(dataDir, now = () => new Date()) {
    this.file = path.join(dataDir, "health.json");
    this.now = now;
    this.pending = Promise.resolve();
  }

  async read() {
    try {
      return upgradeCatalog(JSON.parse(await readFile(this.file, "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return upgradeCatalog({ activities: [], members: [] });
    }
  }

  // Serialize read-modify-write operations and publish the file in one rename.
  change(update) {
    const operation = this.pending.then(async () => {
      const data = await this.read();
      const result = update(data);
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file + ".tmp", JSON.stringify(data), { mode: 0o600 });
      await rename(this.file + ".tmp", this.file);
      return result;
    });
    this.pending = operation.catch(() => {});
    return operation;
  }

  async week(displayName, familyNames = []) {
    const name = nameOf(displayName, 12);
    const data = await this.read();
    const people = [name, ...data.members.map(m => m.name), ...familyNames];
    const member = data.members.find(m => memberNameKey(m.name) === memberNameKey(name));
    return {
      members: [...new Map(people.map(n => [memberNameKey(n), n])).values()],
      activities: data.activities,
      days: weekEnding(this.now()).map(date => {
        const ids = member?.days[date] ?? [];
        return { date, ids, score: ids.length };
      })
    };
  }

  editActivity(id, input) {
    return this.change(({ activities }) => {
      let activity = id ? activities.find(item => item.id === id) : null;
      if (id && !activity) throw new Error("事项不存在");
      if (activity && input.active === false) {
        activity.active = false;
        return activity;
      }
      const name = nameOf(input.name, 32);
      if (activities.some(a => a.active && a.id !== id && memberNameKey(a.name) === memberNameKey(name))) {
        throw new Error("已有同名事项");
      }
      if (activity) {
        activity.name = name;
      } else {
        const color = activityColor(activities.length);
        activity = { id: randomUUID(), name, color, active: true };
        activities.push(activity);
      }
      return activity;
    });
  }

  checkIn({ displayName, date, changes }) {
    return this.change(data => {
      const name = nameOf(displayName, 12);
      if (!weekEnding(this.now()).includes(date)) throw new Error("只能修改北京时间最近七天的记录");
      if (!Array.isArray(changes) || !changes.length) throw new Error("请选择事项");
      let member = data.members.find(m => memberNameKey(m.name) === memberNameKey(name));
      if (!member) {
        member = { name, days: {} };
        data.members.push(member);
      }
      const ids = new Set(member.days[date]);
      for (const { id, done } of changes) {
        const activity = data.activities.find(a => a.id === id);
        if (!activity?.active || typeof done !== "boolean") throw new Error("事项已停用或选择无效");
        if (done) ids.add(id);
        else ids.delete(id);
      }
      member.days[date] = [...ids];
      return { date, ids: [...ids], score: ids.size };
    });
  }
}

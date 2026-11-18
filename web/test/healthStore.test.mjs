import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { HealthStore } from "../server/healthStore.mjs";

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "miemie-health-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let time = new Date("2026-11-18T15:59:59Z");
  const now = () => time;
  return {
    store: new HealthStore(dir, now),
    dir,
    reopen: () => new HealthStore(dir, now),
    midnight: () => { time = new Date("2026-11-18T16:00:00Z"); }
  };
}

test("all eleven default check-ins include guidance and can each earn one point", async t => {
  const { store } = await fixture(t);
  const { activities } = await store.week("甲");
  assert.deepEqual(activities.map(a => a.name), ["顺畅便便", "健身", "23:30 前睡觉", "饭后溜达", "屁股放个假",
    "蔬菜有戏", "肩膀下班", "手机先睡", "今天几分甜", "全家放风", "心情开个麦"]);
  assert.ok(activities.every(a => a.active && a.description?.trim()));
  assert.equal(new Set(activities.map(a => a.color)).size, 11);
  const changes = activities.map(a => ({ id: a.id, done: true }));
  assert.equal((await store.checkIn({ displayName: "甲", date: "2026-11-18", changes })).score, 11);
});

test("upgrading an existing family keeps renamed, retired, and matching custom activities", async t => {
  const { dir, store, reopen } = await fixture(t);
  await writeFile(path.join(dir, "health.json"), JSON.stringify({
    activities: [
      { id: "bowel", name: "顺畅便便", active: false, color: "#dc9276" },
      { id: "exercise", name: "游泳", active: true, color: "#56ad91" },
      { id: "sleep", name: "23:30 前睡觉", active: true, color: "#9392c9" },
      { id: "my-walk", name: "饭后溜达", active: true, color: "#123456" }
    ],
    members: [{ name: "甲", days: { "2026-11-18": ["my-walk"] } }]
  }));
  const { activities, days } = await store.week("甲");
  assert.equal(activities.length, 11);
  assert.equal(days.at(-1).score, 1);
  assert.deepEqual(days.at(-1).ids, ["my-walk"]);
  const walk = activities.find(a => a.id === "my-walk");
  assert.equal(walk.color, "#123456");
  assert.match(walk.description, /10 分钟/);
  assert.equal(activities.find(a => a.id === "exercise").name, "游泳");
  assert.equal(activities.find(a => a.id === "bowel").active, false);
  await store.editActivity(walk.id, { name: "饭后走一圈" });
  const saved = await reopen().week("甲");
  assert.equal(saved.activities.length, 11);
  assert.equal(saved.activities.filter(a => a.name === "饭后溜达").length, 0);
  assert.equal(saved.days.at(-1).score, 1);
});

test("health week rolls over in Beijing and enforces a seven-day edit window", async t => {
  const { store, midnight } = await fixture(t);
  const save = date => store.checkIn({ displayName: "甲", date, changes: [{ id: "sleep", done: true }] });
  await save("2026-11-12");
  await save("2026-11-18");
  await assert.rejects(save("2026-11-19"), /最近七天/);
  midnight();
  await assert.rejects(save("2026-11-12"), /最近七天/);
  const { days } = await store.week("甲");
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2026-11-13");
  assert.equal(days[5].score, 1);
  assert.deepEqual(days[6], { date: "2026-11-19", ids: [], score: 0 });
});

test("concurrent and repeated check-ins persist by normalized name and date", async t => {
  const { store, reopen } = await fixture(t);
  const date = "2026-11-18";
  const set = (displayName, id, done = true) => store.checkIn({ displayName, date, changes: [{ id, done }] });
  await Promise.all([set("Amy", "exercise"), set(" ＡＭＹ ", "bowel"), set("乙", "sleep")]);
  await set("amy", "bowel");
  const result = await reopen().week("amy");
  assert.equal(result.days.at(-1).score, 2);
  assert.equal(result.members.length, 2);
  assert.equal((await store.week("乙")).days.at(-1).score, 1);
  assert.equal((await set("amy", "bowel", false)).score, 1);
  assert.equal((await set("amy", "exercise", false)).score, 0);
});

test("retired activities keep their color and historical score during backfill", async t => {
  const { store } = await fixture(t);
  const added = await store.editActivity(null, { name: "散步" });
  const edit = changes => store.checkIn({ displayName: "甲", date: "2026-11-12", changes });
  await edit([{ id: added.id, done: true }]);
  await assert.rejects(store.editActivity(null, { name: " 散步 " }), /同名/);
  await store.editActivity(added.id, { name: "出门走走" });
  await store.editActivity(added.id, { active: false });
  await assert.rejects(edit([{ id: "sleep", done: true }, { id: added.id, done: false }]), /停用/);
  assert.deepEqual((await store.week("甲")).days[0].ids, [added.id]);
  assert.equal((await edit([{ id: "bowel", done: true }])).score, 2);
  const { activities } = await store.week("甲");
  assert.deepEqual(activities.at(-1), { ...added, name: "出门走走", active: false });
});

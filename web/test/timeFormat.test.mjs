import assert from "node:assert/strict";
import test from "node:test";

import { formatRelativeTime, formatTime } from "../public/timeFormat.js";

test("formats today's timestamp as time only", () => {
  const now = new Date("2026-07-06T12:00:00+08:00");

  assert.equal(formatTime("2026-07-06T09:06:00+08:00", now), "09:06");
});

test("adds day context for older timestamps", () => {
  const now = new Date("2026-07-06T12:00:00+08:00");

  assert.equal(formatTime("2026-07-05T09:06:00+08:00", now), "昨天 09:06");
  assert.equal(formatTime("2026-07-04T09:06:00+08:00", now), "7月4日 09:06");
  assert.equal(formatTime("2025-12-31T09:06:00+08:00", now), "2025年12月31日 09:06");
});

test("relative time falls back to date-aware time after an hour", () => {
  const now = new Date("2026-07-06T12:00:00+08:00");

  assert.equal(formatRelativeTime("2026-07-06T11:59:30+08:00", now), "刚刚");
  assert.equal(formatRelativeTime("2026-07-06T11:52:00+08:00", now), "8 分钟前");
  assert.equal(formatRelativeTime("2026-07-05T09:06:00+08:00", now), "昨天 09:06");
});
